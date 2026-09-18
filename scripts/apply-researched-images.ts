/**
 * Store researched Commons files and attach them to the events they were chosen for.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/apply-researched-images.ts \
 *     <subjects.json> <picks.jsonl> [<picks.jsonl> …] [--dry]
 *
 * `subjects.json` is the research manifest: `[{ key, slugs: [...], series_slug, split_series }]`.
 * Each `picks.jsonl` line is `{ "key": "<subject key>", "file": "File:….jpg" | null, "note": "…" }`.
 *
 * Every file goes through the same gate as the automatic chain (`CommonsVerifier.verify` →
 * `storeLicensedImage`), so a pick that does not pass is reported and skipped, never stored.
 * Events that already have an image are left alone; a series inherits the file unless the subject
 * was split per country.
 */
import { readFileSync } from "node:fs";
import { makeContext } from "@/lib/enrich/context";
import { attachImageToEvent, attachImageToSeries, storeLicensedImage } from "@/lib/enrich/images/process";
import { CommonsVerifier } from "@/lib/enrich/images/commons";
import { getDb } from "@/lib/ingest/db";

type Subject = { key: string; slugs: string[]; series_slug: string | null; split_series?: boolean; subject: string };
type Pick = { key: string; file: string | null; note?: string };

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const files = args.filter((a) => !a.startsWith("--"));
if (files.length < 2) throw new Error("usage: apply-researched-images <subjects.json> <picks.jsonl>… [--dry]");

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
    if (seen.has(pick.key)) continue;
    seen.add(pick.key);
    if (!pick.file) continue;
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
        continue;
      }
      if (dry) {
        console.log(`ok (dry) ${subject.subject} :: ${pick.file} :: ${verdict.image.license} ${verdict.image.width}x${verdict.image.height}`);
        continue;
      }
      const stored = await storeLicensedImage(db, verdict.image);
      if (stored.reused) stats.reused++;
      else stats.stored++;

      const { data: events, error } = await db.from("events").select("id, slug").in("slug", subject.slugs).is("image_id", null);
      if (error) throw new Error(error.message);
      for (const event of events ?? []) {
        await attachImageToEvent(db, event.id, stored.imageId);
        stats.eventsAttached++;
      }
      if (subject.series_slug && !subject.split_series) {
        await attachImageToSeries(db, subject.series_slug, stored.imageId);
        stats.seriesAttached++;
      }
      console.log(`OK ${subject.subject} :: ${pick.file} :: ${verdict.image.license} → ${events?.length ?? 0} events`);
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
