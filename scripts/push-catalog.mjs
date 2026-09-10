#!/usr/bin/env node
/**
 * Build the Until catalog from all sources and push it to Supabase.
 *
 *   node --env-file=.env.local scripts/push-catalog.mjs [--dry-run]
 *        [--only=holidays,curated,recurring,wikidata,wikipedia] [--out=<path>]
 *        [--write-countries]
 *
 * --dry-run prints counts, the 5 nearest rows, writes every row as JSON to
 * --out (default: <os tmpdir>/until-catalog-rows.json) and never touches the
 * database or the repo. Otherwise src/data/countries.json is refreshed and rows
 * are sent in chunks of 500 to public.upsert_events(p_rows jsonb), then
 * finalize_catalog() is called. --write-countries forces the countries file
 * even on a dry run.
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  YEARS,
  slugify,
  mergeAll,
  expandCurated,
  expandRecurring,
  farFutureCutoffMs,
  loadHolidays,
  loadCountryNames,
  loadWikidata,
  loadWikipediaYears,
} from "./lib/seed-sources.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COUNTRIES_OUT = resolve(ROOT, "src/data/countries.json");
const DEFAULT_OUT = join(tmpdir(), "until-catalog-rows.json");

const ALL_SOURCES = ["holidays", "curated", "recurring", "wikidata", "wikipedia"];
const CHUNK = 500;
const TITLE_MIN = 2;
const TITLE_MAX = 200;

const CATEGORY_SLUGS = new Set([
  "holidays", "national", "religion", "awareness", "fun", "culture", "festivals", "sports",
  "esports", "games", "film", "tv", "anime", "music", "entertainment", "politics", "tech",
  "science", "space", "astronomy", "nature", "history", "curiosities",
]);
const SOURCE_IDS = new Set(["holidays", "curated", "wikipedia", "wikidata"]);
const PRECISION_RANK = { instant: 0, day: 1, month: 2, quarter: 3, year: 4, decade: 5 };

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { dryRun: false, writeCountries: false, only: new Set(ALL_SOURCES), out: DEFAULT_OUT };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--write-countries") opts.writeCountries = true;
    else if (arg.startsWith("--only=")) {
      const list = arg.slice(7).split(",").map((s) => s.trim()).filter(Boolean);
      const bad = list.filter((s) => !ALL_SOURCES.includes(s));
      if (bad.length) throw new Error(`Unknown --only source(s): ${bad.join(", ")}`);
      opts.only = new Set(list);
    } else if (arg.startsWith("--out=")) opts.out = resolve(arg.slice(6));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Row conversion
// ---------------------------------------------------------------------------

function validDate(s) {
  if (typeof s !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(s)) return false;
  return !Number.isNaN(Date.parse(s.includes("T") ? s : `${s}T00:00:00Z`));
}

function contentHash(row) {
  const stable = {
    title: row.title,
    description: row.description,
    date: row.date,
    end_date: row.end_date,
    all_day: row.all_day,
    category: row.category,
    tags: [...row.tags].sort(),
    regions: [...row.regions].sort(),
    source: row.source,
    source_url: row.source_url,
    featured: row.featured,
    popularity: row.popularity,
    status: row.status,
    date_precision: row.date_precision,
    confidence: row.confidence,
    external_ids: sortedObject(row.external_ids || {}),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function sortedObject(obj) {
  return Object.fromEntries(
    Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => [k, obj[k]]),
  );
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function sourceKey(ev) {
  switch (ev.source) {
    case "holidays":
      return `holidays:${ev.slug}`;
    case "curated":
      return `curated:${ev.slug}`;
    case "wikipedia":
      return `wikipedia:${ev.date.slice(0, 4)}:${slugify(ev.title).slice(0, 60)}`;
    case "wikidata": {
      const qid = ev.externalIds?.qid || String(ev.sourceUrl || "").split("/").pop();
      return `wikidata:${qid}`;
    }
    default:
      return `${ev.source}:${ev.slug}`;
  }
}

function confidenceFor(ev, precision) {
  if (typeof ev.confidence === "number") return ev.confidence;
  switch (ev.source) {
    case "curated":
    case "holidays":
      return 1.0;
    case "wikipedia":
      return 0.8;
    case "wikidata":
      return PRECISION_RANK[precision] > PRECISION_RANK.day ? 0.6 : 0.7;
    default:
      return 0.5;
  }
}

/** Convert one merged in-memory event to the snake_case row for upsert_events. */
export function toRow(ev) {
  const isInstant = ev.date.includes("T");
  const precision = isInstant ? "instant" : ev.datePrecision || "day";
  const coarse = (PRECISION_RANK[precision] ?? 1) > PRECISION_RANK.day;
  const status = ev.status || (coarse ? "tentative" : "scheduled");
  const category = CATEGORY_SLUGS.has(ev.category) ? ev.category : "culture";
  // DB: end_date must be >= date (day granularity); a bad curated/Wikidata range becomes single-day.
  const endDate =
    ev.endDate && ev.endDate.slice(0, 10) >= ev.date.slice(0, 10) ? ev.endDate : null;
  const row = {
    slug: ev.slug,
    title: String(ev.title).trim(),
    description: ev.description || "",
    summary: null,
    date: ev.date,
    end_date: endDate,
    all_day: ev.allDay !== false && !isInstant,
    timezone: null,
    category,
    tags: [...new Set(ev.tags)],
    regions: ev.regions.length ? [...new Set(ev.regions)] : ["GLOBAL"],
    source: ev.source,
    source_url: ev.sourceUrl || null,
    source_key: sourceKey(ev),
    external_ids: ev.externalIds || {},
    status,
    date_precision: precision,
    confidence: clamp(Number(confidenceFor(ev, precision)) || 0, 0, 1),
    featured: Boolean(ev.featured),
    popularity: clamp(Math.round(Number(ev.popularity ?? 20)) || 0, 0, 100),
    series_slug: null,
    location: null,
    jsonld_eligible: false,
    image_candidate_url: null,
    image_candidate_meta: null,
    content_hash: null,
    raw: null,
  };
  row.content_hash = contentHash(row);
  return row;
}

export function buildRows(events) {
  const farMs = farFutureCutoffMs();
  const seenKeys = new Set();
  const dropped = { slug: 0, title: 0, date: 0, far: 0, source: 0, dupKey: 0 };
  const rows = [];
  for (const ev of events) {
    if (!ev?.slug || ev.slug.startsWith("mine-") || ev.slug.startsWith("share-")) {
      dropped.slug++;
      continue;
    }
    const titleLen = String(ev.title ?? "").trim().length;
    if (titleLen < TITLE_MIN || titleLen > TITLE_MAX) {
      dropped.title++;
      continue;
    }
    if (!validDate(ev.date) || (ev.endDate && !validDate(ev.endDate))) {
      dropped.date++;
      continue;
    }
    if (!SOURCE_IDS.has(ev.source)) {
      dropped.source++;
      continue;
    }
    const t = Date.parse(ev.date.includes("T") ? ev.date : `${ev.date}T00:00:00Z`);
    if (t > farMs && !ev.tags.includes("far-future")) {
      dropped.far++;
      continue;
    }
    const row = toRow(ev);
    if (seenKeys.has(row.source_key)) {
      dropped.dupKey++;
      continue;
    }
    seenKeys.add(row.source_key);
    rows.push(row);
  }
  return { rows, dropped };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function countBy(rows, key) {
  const out = {};
  for (const r of rows) out[r[key]] = (out[r[key]] || 0) + 1;
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

function nearest(rows, n = 5) {
  const now = Date.now();
  return rows
    .map((r) => ({ r, t: Date.parse(r.date.includes("T") ? r.date : `${r.date}T00:00:00Z`) }))
    .filter((x) => x.t >= now - 86400000)
    .sort((a, b) => a.t - b.t)
    .slice(0, n)
    .map(({ r }) => `${r.date}  ${r.title}  [${r.source}/${r.category}/${r.date_precision}]`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------


async function revalidateSite() {
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
    console.warn("revalidate: failed", err?.message ?? err);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const t0 = Date.now();
  console.log(
    `push-catalog: years ${YEARS[0]}–${YEARS[YEARS.length - 1]}, sources ${[...opts.only].join(",")}` +
      (opts.dryRun ? " (dry run)" : ""),
  );

  // 1. Countries file (offline, from date-holidays). Skipped on --dry-run so a
  //    dry run leaves the repo untouched; pass --write-countries to force it.
  if (!opts.dryRun || opts.writeCountries) {
    try {
      const countries = loadCountryNames();
      await mkdir(dirname(COUNTRIES_OUT), { recursive: true });
      await writeFile(COUNTRIES_OUT, JSON.stringify(countries, null, 2) + "\n");
      console.log(`Wrote ${Object.keys(countries).length - 1} countries → ${COUNTRIES_OUT}`);
    } catch (err) {
      console.warn(`countries.json not refreshed: ${err.message}`);
    }
  }

  // 1b. Source lists (each loader fails soft on its own).
  const lists = [];
  if (opts.only.has("holidays")) lists.push(loadHolidays());
  if (opts.only.has("recurring")) lists.push(expandRecurring());
  if (opts.only.has("curated")) lists.push(expandCurated());
  const network = [];
  if (opts.only.has("wikipedia")) network.push(loadWikipediaYears());
  if (opts.only.has("wikidata")) network.push(loadWikidata());
  for (const list of await Promise.all(network)) lists.push(list);

  const perSource = {};
  for (const list of lists) for (const ev of list) perSource[ev.source] = (perSource[ev.source] || 0) + 1;
  console.log("Raw per source:", perSource);

  const merged = mergeAll(lists);
  console.log(`Merged: ${merged.length} events`);

  // 2. Rows.
  const { rows, dropped } = buildRows(merged);
  console.log(`Rows: ${rows.length} (dropped ${JSON.stringify(dropped)})`);
  const slugs = new Set(rows.map((r) => r.slug));
  if (slugs.size !== rows.length) {
    console.warn(`Warning: ${rows.length - slugs.size} duplicate slugs remain after merge`);
  }

  console.log("By source:", countBy(rows, "source"));
  console.log("By category:", countBy(rows, "category"));
  console.log("By precision:", countBy(rows, "date_precision"));
  console.log("Nearest:");
  for (const line of nearest(rows)) console.log("  " + line);

  // 3. Dry run: write JSON and stop.
  if (opts.dryRun) {
    await mkdir(dirname(opts.out), { recursive: true });
    await writeFile(opts.out, JSON.stringify(rows, null, 1));
    console.log(`Dry run: wrote ${rows.length} rows → ${opts.out} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    return;
  }

  // 4. Push.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required (run with --env-file=.env.local)");
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const totals = { inserted: 0, updated: 0, unchanged: 0, drifted: 0 };
  const chunks = Math.ceil(rows.length / CHUNK);
  const failedChunks = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const n = i / CHUNK + 1;
    const { data, error } = await supabase.rpc("upsert_events", { p_rows: chunk });
    if (error) {
      // One bad row rolls back the whole chunk inside plpgsql; log it and keep
      // going so the other chunks still land.
      console.error(`upsert_events chunk ${n}/${chunks} failed:`, error.message || error);
      console.error(`  slugs: ${chunk.map((r) => r.slug).join(", ")}`);
      failedChunks.push(n);
      continue;
    }
    const result = Array.isArray(data) ? data[0] : data;
    for (const k of Object.keys(totals)) totals[k] += Number(result?.[k] ?? 0);
    console.log(
      `  chunk ${n}/${chunks} (${chunk.length} rows): +${result?.inserted ?? 0} ins, ` +
        `${result?.updated ?? 0} upd, ${result?.unchanged ?? 0} same, ${result?.drifted ?? 0} drift`,
    );
  }
  const fin = await supabase.rpc("finalize_catalog");
  if (fin.error) {
    console.error("finalize_catalog failed:", fin.error.message || fin.error);
    process.exit(1);
  }
  console.log("finalize_catalog: ok");
  await revalidateSite();
  console.log("Totals:", totals, `(${rows.length} rows, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (failedChunks.length) {
    console.error(`${failedChunks.length}/${chunks} chunk(s) failed: ${failedChunks.join(", ")}`);
    process.exit(1);
  }
}

const isEntryPoint =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
