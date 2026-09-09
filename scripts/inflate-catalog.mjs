#!/usr/bin/env node
/** Restore src/data/events.json from gzip parts, or run the live seed. */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "src/data/events.json");
const GZ = resolve(ROOT, "src/data/events.json.gz");
const PART_DIR = resolve(ROOT, "src/data");

function partFiles() {
  return Array.from({ length: 8 }, (_, i) =>
    resolve(PART_DIR, `events.json.gz.b64.${String(i + 1).padStart(2, "0")}`),
  ).filter((p) => existsSync(p));
}

async function inflateFromParts() {
  const parts = partFiles();
  if (parts.length === 0 && !existsSync(GZ)) return false;
  const b64 = parts.length
    ? (await Promise.all(parts.map((p) => readFile(p, "utf8")))).join("").replace(/\s+/g, "")
    : (await readFile(GZ)).toString("base64");
  const buf = parts.length ? Buffer.from(b64, "base64") : await readFile(GZ);
  const json = gunzipSync(buf);
  await writeFile(OUT, json);
  const parsed = JSON.parse(json.toString("utf8"));
  console.log(`Inflated catalog: ${parsed.count} events`);
  return parsed.count > 100;
}

function runSeed() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [resolve(ROOT, "scripts/seed.mjs")], {
      cwd: ROOT,
      stdio: "inherit",
    });
    child.on("exit", (code) => (code === 0 ? resolvePromise() : reject(new Error(`seed exited ${code}`))));
  });
}

const ok = await inflateFromParts();
if (!ok) {
  console.log("No packed catalog found — running live seed…");
  await runSeed();
}
