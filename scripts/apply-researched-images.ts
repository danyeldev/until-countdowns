/**
 * Store researched Commons files and attach them to the events they were chosen for.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/apply-researched-images.ts \
 *     <subjects.json> <picks.jsonl> [<picks.jsonl> …] [--dry] [--done <keys.txt>]
 *
 * `subjects.json` is the research manifest: `[{ key, slugs: [...], series_slug, split_series }]`.
 * Each `picks.jsonl` line is `{ "key": "<subject key>", "file": "File:….jpg" | null, "note": "…" }`.
 * `--done` names a file of already-handled keys: they are skipped, and every key handled in this
 * run is appended, so the script can be re-run over growing pick files while research continues.
 *
 * Every file goes through the same gate as the automatic chain (`CommonsVerifier.verify` →
 * `storeLicensedImage`), so a pick that does not pass is reported and skipped, never stored.
 * Events that already have an image are left alone; a series inherits the file unless the subject
 * was split per country.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { makeContext } from "@/lib/enrich/context";
import { attachImageToSeries, storeLicensedImage } from "@/lib/enrich/images/process";
import { CommonsVerifier } from "@/lib/enrich/images/commons";
import { getDb } from "@/lib/ingest/db";

type Subject = { key: string; slugs: string[]; series_slug: string | null; split_series?: boolean; subject: string };
type Pick = { key: string; file: string | null; note?: string };

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const doneFlag = args.indexOf("--done");
const donePath = doneFlag >= 0 ? args[doneFlag + 1] : null;
const files = args.filter((a, i) => !a.startsWith("--") && i !== doneFlag + 1);
if (files.length < 2) throw new Error("usage: apply-researched-images <subjects.json> <picks.jsonl>… [--dry] [--done keys.txt]");
const done = new Set<string>(
  donePath && existsSync(donePath) ? readFileSync(donePath, "utf8").split("\n").map((l) => l.trim()).filter(Boolean) : [],
);
function markDone(key: string): void {
  if (!donePath || dry) return;
  appendFileSync(donePath, `${key}\n`);
}

const subjects = new Map<string, Subject>();
for (const s of JSON.parse(readFileSync(files[0], "utf8")) as Subject[]) subjects.set(s.key, s);

const picks: Pick[] = [];
for (const path of files.slice(1)) {
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const pick = JSON.parse(trimmed) as Pick;
      if (pick && typeof pick.key === "string") picks.push(pick);
    } catch {
      console.log("unparseable line:", trimmed.slice(0, 120));
    }
  }
}

async function main(): Promise<void> {
  const db = await getDb();
  const ctx = makeContext({ deadline: Date.now() + 6 * 3600_000, scope: "apply-research", dryRun: dry });
  const verifier = new CommonsVerifier(ctx);
  const stats = { picks: picks.length, withFile: 0, stored: 0, reused: 0, rejected: 0, unknownKey: 0, eventsAttached: 0, seriesAttached: 0, errors: 0 };
  const seen = new Set<string>();

  for (const pick of picks) {
    if (seen.has(pick.key) || done.has(pick.key)) continue;
    seen.add(pick.key);
    if (!pick.file) {
      markDone(pick.key);
      continue;
    }
    stats.withFile++;
    const subject = subjects.get(pick.key);
    if (!subject) {
      stats.unknownKey++;
      console.log("unknown key", pick.key);
      continue;
    }
    try {
      const verdict = await verifier.verify(pick.file, "research");
      if (!verdict.ok) {
        stats.rejected++;
        console.log(`REJECT ${subject.subject} :: ${pick.file} :: ${verdict.reason}`);
        markDone(pick.key);
        continue;
      }
      if (dry) {
        console.log(`ok (dry) ${subject.subject} :: ${pick.file} :: ${verdict.image.license} ${verdict.image.width}x${verdict.image.height}`);
        continue;
      }
      const stored = await storeLicensedImage(db, verdict.image);
      if (stored.reused) stats.reused++;
      else stats.stored++;

      // One statement for the whole subject (a series can have 100+ occurrences); the
      // `.is("image_id", null)` filter keeps a curated image from being overwritten, exactly as
      // `attachImageToEvent` does for a single row.
      let attached = 0;
      for (let i = 0; i < subject.slugs.length; i += 200) {
        const { data: events, error } = await db
          .from("events")
          .update({ image_id: stored.imageId, image_status: "ok" })
          .in("slug", subject.slugs.slice(i, i + 200))
          .is("image_id", null)
          .select("id");
        if (error) throw new Error(error.message);
        attached += events?.length ?? 0;
      }
      stats.eventsAttached += attached;
      if (subject.series_slug && !subject.split_series) {
        await attachImageToSeries(db, subject.series_slug, stored.imageId);
        stats.seriesAttached++;
      }
      console.log(`OK ${subject.subject} :: ${pick.file} :: ${verdict.image.license} → ${attached} events`);
      markDone(pick.key);
    } catch (err) {
      stats.errors++;
      console.log(`ERROR ${subject.subject} :: ${pick.file} :: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log("apply done", stats);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
