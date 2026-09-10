/**
 * Run one ingest source from the command line (same code path as the cron routes).
 *
 *   npm run ingest -- --source=<id> [--dry-run] [--force] [--budget=<ms>]
 *   npm run ingest -- --list
 *
 * Runs under `--conditions=react-server` so `server-only` (src/lib/db/admin.ts) is inert.
 * Cache tags cannot be invalidated outside Next: set REVALIDATE_URL=https://<site>/api/revalidate
 * (with CRON_SECRET) and the script POSTs there after a run that changed rows.
 */
import { runSource } from "@/lib/ingest/run";
import { listSources } from "@/lib/ingest/sources/index";

type Args = { source?: string; dryRun: boolean; force: boolean; budgetMs?: number; list: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, force: false, list: false };
  for (const a of argv) {
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--force") args.force = true;
    else if (a === "--list") args.list = true;
    else if (a.startsWith("--source=")) args.source = a.slice("--source=".length);
    else if (a.startsWith("--budget=")) {
      const n = Number(a.slice("--budget=".length));
      if (!Number.isFinite(n) || n <= 0) throw new Error(`bad --budget: ${a}`);
      args.budgetMs = n;
    } else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

async function revalidateSite(): Promise<void> {
  const url = process.env.REVALIDATE_URL;
  const secret = process.env.CRON_SECRET;
  if (!url || !secret) {
    console.log("revalidate: skipped (set REVALIDATE_URL=https://<site>/api/revalidate and CRON_SECRET to purge the site cache)");
    return;
  }
  try {
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    console.log(`revalidate: ${res.status} ${await res.text()}`);
  } catch (err) {
    console.warn("revalidate: failed", (err as Error)?.message ?? err);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.list) {
    for (const s of listSources()) console.log(`${s.id.padEnd(14)} rank ${s.rank}  ${s.cadence.padEnd(8)} ${s.label}`);
    return;
  }
  if (!args.source) throw new Error("--source=<id> is required (or --list)");
  const summary = await runSource(args.source, { trigger: "manual", dryRun: args.dryRun, force: args.force, budgetMs: args.budgetMs });
  console.log(JSON.stringify(summary, null, 2));
  if (!args.dryRun && summary.inserted + summary.updated + summary.drifted > 0) await revalidateSite();
  if (summary.status === "error") process.exitCode = 1;
}

main().catch((err) => {
  // Same shape as a run summary so callers can parse it (failures before the runner's try/finally).
  const error = err instanceof Error ? err.message : String(err);
  const source = process.argv.find((a) => a.startsWith("--source="))?.slice("--source=".length) ?? null;
  console.error(JSON.stringify({ evt: "ingest_run", source, status: "error", trigger: "manual", error }));
  console.error(JSON.stringify({ source, status: "error", errors: [{ message: error }] }, null, 2));
  process.exit(1);
});
