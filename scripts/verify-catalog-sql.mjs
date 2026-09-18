/**
 * Run actual catalog SQL against a disposable PostgreSQL container.
 * No host ports, host mounts or remote credentials are used. The container is
 * removed in finally, including when a migration or assertion fails.
 * Usage: node scripts/verify-catalog-sql.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = new URL("../", import.meta.url);
const name = `until-sql-check-${process.pid}-${Date.now()}`;
const image = process.env.POSTGRES_TEST_IMAGE || "public.ecr.aws/supabase/postgres:17.6.1.155";
let container;

function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", timeout: 120_000, maxBuffer: 10 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || `docker exited ${result.status}`);
  return result;
}

try {
  container = docker([
    "run", "--detach", "--rm", "--network", "none", "--name", name,
    "-e", "POSTGRES_PASSWORD=local-verification-only", "-e", "POSTGRES_DB=until_verify", image,
  ]).stdout.trim();
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    // The entrypoint briefly starts a bootstrap server, then restarts it. Wait
    // until postgres is PID 1 before accepting pg_isready's success response.
    const processName = spawnSync("docker", ["exec", container, "cat", "/proc/1/comm"], { encoding: "utf8", timeout: 2000 });
    const result = spawnSync("docker", ["exec", container, "pg_isready", "-U", "supabase_admin"], { stdio: "ignore", timeout: 2000 });
    if (/postgres/.test(processName.stdout ?? "") && result.status === 0) { ready = true; break; }
    await delay(250);
  }
  if (!ready) throw new Error("Disposable PostgreSQL did not become ready");

  const psqlFor = (database) => ["exec", "-i", container, "psql", "-U", "supabase_admin", "-d", database, "-v", "ON_ERROR_STOP=1", "-q", "-A", "-t"];
  // The Storage API creates storage.buckets/objects. This image does not, so stub
  // the objects catalog migrations expect before any project SQL runs.
  docker(
    psqlFor("until_verify"),
    `
    create schema if not exists storage;
    create table if not exists storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table if not exists storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text,
      name text
    );
    create or replace function storage.foldername(object_name text)
    returns text[]
    language sql
    immutable
    as $$ select coalesce(string_to_array(object_name, '/'), array[]::text[]); $$;
    `,
  );
  // Dedicated storage-only migrations still stay out of these catalog checks.
  const migrations = readdirSync(new URL("supabase/migrations/", root)).filter((file) => file.endsWith(".sql") && file !== "0003_storage.sql").sort();
  // The search fix also ships independently of the three earlier pending migrations.
  // Verify the actual deployed-core + search path in a separate empty database.
  // Copy only the untouched Supabase image baseline (extensions/auth schemas),
  // before any project migration or fixture has run.
  docker(psqlFor("postgres"), "create database until_verify_standalone template until_verify;");
  const scenarios = [
    { name: "full chain", database: "until_verify", migrations, checks: ["upcoming_catalog.sql", "search_next_occurrences.sql", "catalog_rpc_plans.sql"] },
    { name: "standalone search", database: "until_verify_standalone",
      migrations: migrations.filter((file) => /^\d{4}_/.test(file) || file.endsWith("_search_next_occurrences.sql")),
      checks: ["search_next_occurrences.sql"] },
  ];
  for (const scenario of scenarios) {
    const psql = psqlFor(scenario.database);
    for (const migration of scenario.migrations) {
      try {
        if (migration.endsWith("_astronomy_series_correction.sql")) {
          docker(psql, readFileSync(new URL("tests/sql/astronomy_before.sql", root), "utf8"));
        }
        docker(psql, readFileSync(new URL(`supabase/migrations/${migration}`, root), "utf8"));
        if (migration.endsWith("_astronomy_series_correction.sql")) {
          const result = docker(psql, readFileSync(new URL("tests/sql/astronomy_after.sql", root), "utf8"));
          console.log(result.stderr.trim());
        }
      } catch (error) {
        throw new Error(`${scenario.name}: ${migration}: ${error.message}`, { cause: error });
      }
    }
    console.log(`Applied ${scenario.migrations.length} catalog migrations to isolated PostgreSQL (${scenario.name}).`);
    for (const check of scenario.checks) {
      const result = docker(psql, readFileSync(new URL(`tests/sql/${check}`, root), "utf8"));
      console.log(result.stderr.trim());
      console.log(`SQL assertions passed (${scenario.name}): ${fileURLToPath(new URL(`tests/sql/${check}`, root))}`);
    }
  }
} finally {
  if (container) docker(["stop", "--timeout", "1", container]);
}
