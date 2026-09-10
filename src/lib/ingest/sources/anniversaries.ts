import { buildEvent, classify, clamp, FAR_FUTURE_YEARS, isFarFuture, isFutureOrFar, isoDate, precisionFromWikidata, sanitizeTitle } from "../normalize";
import type { Adapter, IngestEvent, Json, Plan, Unit } from "../types";

/**
 * Round-number anniversaries of notable past events, from Wikidata (CC0 statements; optional
 * credit "Data: Wikidata (CC0)"). An item qualifies when its truthy `P585` (point in time) has
 * day precision, it has more than `MIN_SITELINKS` sitelinks (notability proxy) and an English
 * Wikipedia article, and it is not a person, a year/decade/century item, a recurring-event or
 * recurring-edition class, a sub-event of a same-day parent, or a thinly-linked aviation
 * accident. For every N in `ANNIVERSARY_YEARS` the original dates are harvested from the window
 * `[now - N years, now + 15 years - N years)` so that every emitted anniversary falls inside
 * the catalog horizon. Titles and descriptions are written here from the label and the dates
 * - no Wikipedia prose is copied.
 *
 * Units are date slices of one N's window (`anniversaries:<N>:<from>`); the cursor is
 * `{ n, from }` with `from` the first original date not yet harvested, so a pass resumed days
 * later continues from the same point instead of an index into a set that has shifted.
 * A slice that fills the page limit - or that had to be narrowed to answer - resumes from the
 * last date it actually covered.
 *
 * Query shape (measured 2026-09-09, all against WDQS with the ingest UA): the natural
 * "truthy P585 range scan, then join the statement node for precision" form lets Blazegraph
 * choose a plan that enters through the `wikibase:timePrecision` index and dies on the 60 s
 * kill for any dense 19th/20th-century window (1890-09-07..1891-09-07 returned 504 at 65 s).
 * The selective part - date range + sitelinks + enwiki - is pushed into a sub-SELECT and the
 * outer group is pinned with `hint:Group hint:optimizer "None"` so the joins run in textual
 * order over the few items that survive it. Same rows, ~50x faster: that window now answers in
 * 1 s, the whole 15-year N=150 window in 1 s and the densest (N=25) window in 18 s.
 * `run()` still narrows adaptively on 502/504/timeout as a safety net, halving the slice down
 * to a one-year floor before reporting the unit failed.
 *
 * WDQS terms: descriptive User-Agent, serial requests, queries killed at 60 s; 502/504 are
 * common and retried. Julian-calendar values (`wikibase:timeCalendarModel` Q1985786) arrive
 * from WDQS converted to the proleptic Gregorian calendar; they are converted back so a 1527
 * event keeps its historical day. Docs: https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service
 *
 * Popularity exemption: brief section 8 prescribes `clamp(floor(sitelinks / 2), 20, 70)` with
 * +10 for N in {100, 250, 500}, which can reach 80 - above the conventions' "high-volume
 * sources cap at 35". The brief's formula is kept deliberately (a 100th anniversary of the
 * September 11 attacks should outrank a minor observance); flagged for the orchestrator rather
 * than silently changed.
 */
export const WD_ENDPOINT = "https://query.wikidata.org/sparql";
export const ANNIVERSARY_YEARS = [25, 50, 75, 100, 150, 200, 250, 500] as const;
export type AnniversaryYears = (typeof ANNIVERSARY_YEARS)[number];
/** Bonus popularity for the marquee round numbers. */
const MARQUEE = new Set<number>([100, 250, 500]);
export const MIN_SITELINKS = 20;
export const PAGE_LIMIT = 2000;
const JULIAN_MODEL = "http://www.wikidata.org/entity/Q1985786";
/**
 * Classes whose instances are never anniversaries: humans (Q5), calendar units (Q577 year,
 * Q3186692 century, Q39911 decade, Q578 millennium), list/timeline pages (Q47150325,
 * Q18340514), and the recurring-event classes. Wikidata does not put "recurring event"
 * (Q15275719) on the individual editions - it uses "recurring sporting event edition"
 * (Q114609228) and "recurring event edition" (Q27968055), which is what actually removes the
 * Grand-Prix / cup-final / awards-ceremony churn (verified 2026-09-09: the 2001-2005 window
 * drops from 143 to 63 items with those two added).
 */
const EXCLUDED_CLASSES = ["Q5", "Q577", "Q3186692", "Q39911", "Q578", "Q47150325", "Q18340514", "Q15275719", "Q114609228", "Q27968055"];
/**
 * Classes that are only anniversary-worthy when widely covered. An aviation accident with 22
 * sitelinks is a routine crash report; the ones above 40 are Tenerife, Challenger, Columbia,
 * Apollo 1, Lockerbie, the Munich air disaster (verified list, 2026-09-09).
 */
const GATED_CLASSES: ReadonlyArray<{ qid: string; minSitelinks: number }> = [{ qid: "Q744913", minSitelinks: 40 }];
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

/**
 * Years per SPARQL slice. With the pinned join order every window answers far inside the 60 s
 * kill (measured: the whole 15-year N=150 window 1 s, N=500 1 s, N=25 18 s, a 4-year modern
 * slice 2-4 s), so slices only have to keep one unit's work modest and bound the cost of a
 * retry: 4 years for the dense modern windows, 8 for everything older. `run()` narrows further
 * on its own if a slice ever times out again.
 */
export function sliceYears(n: number): number {
  return n <= 50 ? 4 : 8;
}

/** A slice narrower than this is never halved again: at that point the query, not the width, is wrong. */
export const MIN_SLICE_DAYS = 366;

// ── Calendar helpers (UTC arithmetic on YYYY-MM-DD strings, no wall-clock reads) ──────────────

export type Ymd = { y: number; m: number; d: number };

export function parseYmd(iso: string): Ymd | null {
  const m = /^(-?\d{4,})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const out = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  return out.m >= 1 && out.m <= 12 && out.d >= 1 && out.d <= 31 ? out : null;
}

export function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Same month and day `years` later; 29 February lands on 28 February in a common year. */
export function addYears(date: Ymd, years: number): Ymd {
  const y = date.y + years;
  const d = date.m === 2 && date.d === 29 && !isLeap(y) ? 28 : date.d;
  return { y, m: date.m, d };
}

/** Julian day number of a proleptic Gregorian date. */
export function gregorianToJdn({ y, m, d }: Ymd): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

/** Julian-calendar date of a Julian day number. */
export function jdnToJulian(jdn: number): Ymd {
  const c = jdn + 32082;
  const dd = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * dd) / 4);
  const mm = Math.floor((5 * e + 2) / 153);
  return { y: dd - 4800 + Math.floor(mm / 10), m: mm + 3 - 12 * Math.floor(mm / 10), d: e - Math.floor((153 * mm + 2) / 5) + 1 };
}

/** Proleptic-Gregorian date of a Julian day number (inverse of `gregorianToJdn`). */
export function jdnToGregorian(jdn: number): Ymd {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const dd = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * dd) / 4);
  const mm = Math.floor((5 * e + 2) / 153);
  return { y: 100 * b + dd - 4800 + Math.floor(mm / 10), m: mm + 3 - 12 * Math.floor(mm / 10), d: e - Math.floor((153 * mm + 2) / 5) + 1 };
}

/** WDQS serves Julian-model values as proleptic Gregorian; this restores the date as written on the item. */
export function gregorianToJulian(date: Ymd): Ymd {
  return jdnToJulian(gregorianToJdn(date));
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function longDate({ y, m, d }: Ymd): string {
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function utcYmd(t: Date): Ymd {
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function ymdToIso(x: Ymd): string {
  return isoDate(x.y, x.m, x.d);
}

// ── Window and query ──────────────────────────────────────────────────────────────────────────

/** Original-date window `[from, to)` whose N-year anniversaries fall in `[now − 2 d, now + 15 y)`. */
export function originalWindow(n: number, now: Date): { from: string; to: string } {
  const today = utcYmd(now);
  const from = addYears(today, -n);
  const start = new Date(Date.UTC(from.y, from.m - 1, from.d - 2));
  const end = addYears(today, FAR_FUTURE_YEARS - n);
  return { from: ymdToIso(utcYmd(start)), to: ymdToIso(end) };
}

export function buildAnniversaryQuery(from: string, to: string, limit = PAGE_LIMIT): string {
  const minus = EXCLUDED_CLASSES.map((q) => `  MINUS { ?item wdt:P31 wd:${q} }`).join("\n");
  const gated = GATED_CLASSES.map((g) => `  FILTER NOT EXISTS { ?item wdt:P31 wd:${g.qid} . FILTER(?sl < ${g.minSitelinks}) }`).join("\n");
  // The sub-SELECT is the selective half (date range on the truthy value with `hint:rangeSafe`,
  // sitelink floor, enwiki article) and cuts a dense two-year window from ~13 000 items to a
  // handful; `hint:Group hint:optimizer "None"` then forces the outer joins to run in textual
  // order over those few items instead of letting Blazegraph enter through the precision index
  // and hit the 60 s kill. `MIN(?dv)` picks one date per item, so an item with two truthy
  // values in the same anniversary year (a two-round election) cannot be emitted twice under
  // the same `source_key` from two different units.
  return `
SELECT ?item ?itemLabel (MIN(?dv) AS ?d) ?prec ?cal ?sl ?enwiki (SAMPLE(?img) AS ?image) (GROUP_CONCAT(DISTINCT ?iso; separator=",") AS ?isos) WHERE {
  hint:Group hint:optimizer "None" .
  {
    SELECT ?item ?dv ?sl ?enwiki WHERE {
      ?item wdt:P585 ?dv . hint:Prior hint:rangeSafe true .
      FILTER(?dv >= "${from}T00:00:00Z"^^xsd:dateTime && ?dv < "${to}T00:00:00Z"^^xsd:dateTime)
      ?item wikibase:sitelinks ?sl . FILTER(?sl > ${MIN_SITELINKS})
      ?enwiki schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
    }
  }
  ?item p:P585 ?st . ?st psv:P585 ?v .
  ?v wikibase:timeValue ?dv ; wikibase:timePrecision ?prec ; wikibase:timeCalendarModel ?cal .
  FILTER(?prec = 11)
  ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")
${minus}
  MINUS { ?item wdt:P361 ?whole . ?whole wdt:P585 ?dv }
${gated}
  OPTIONAL { ?item wdt:P18 ?img }
  OPTIONAL { ?item wdt:P17 ?c . ?c wdt:P297 ?iso }
}
GROUP BY ?item ?itemLabel ?prec ?cal ?sl ?enwiki
ORDER BY ?d ?item
LIMIT ${limit}`.trim();
}

/** Midpoint of `[from, to)`, or null when the span is at the one-year floor and must not be halved. */
export function halveWindow(from: string, to: string): string | null {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a || !b) return null;
  const ja = gregorianToJdn(a);
  const jb = gregorianToJdn(b);
  if (jb - ja <= MIN_SLICE_DAYS) return null;
  return ymdToIso(jdnToGregorian(ja + Math.floor((jb - ja) / 2)));
}

/**
 * A 502/504 or a client-side timeout from WDQS means "this slice is too wide to answer inside
 * the 60 s kill", not "the service is down": retrying the identical query only burns the shared
 * Wikimedia CPU quota, so `run()` halves the window instead. `BudgetExceededError` is never one
 * of these - it must reach the runner so the cursor is kept.
 */
export function isSliceTooWide(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "HttpError") {
    const status = (err as Error & { status?: number }).status;
    return status === 502 || status === 504 || status === 500;
  }
  return err.name === "TimeoutError" || err.name === "AbortError";
}

export type SparqlBinding = Record<string, { type: string; value: string; datatype?: string } | undefined>;

/**
 * A label that names a different year than the original date is a mislinked or placeholder item
 * ("2022 Bosnian presidential election" dated 2026); a season range such as "1927–28" is
 * consistent when the year falls inside it. Same rule as the wikidata adapter, kept local so the
 * two adapters do not load each other.
 */
export function labelYearConsistent(label: string, year: number): boolean {
  const ranges: Array<[number, number]> = [];
  const rest = String(label).replace(/\b((?:1[5-9]|20|21)\d{2})\s*[–—-]\s*(\d{4}|\d{2})\b/g, (_, a: string, b: string) => {
    const start = Number(a);
    let end = b.length === 4 ? Number(b) : Number(a.slice(0, 2) + b);
    if (end < start) end += 100;
    ranges.push([start, end]);
    return " ";
  });
  const years = rest.match(/\b(?:1[5-9]|20|21)\d{2}\b/g) ?? [];
  if (!years.length && !ranges.length) return true;
  return years.every((y) => Number(y) === year) && ranges.every(([s, e]) => year >= s && year <= e);
}

export function enwikiTitle(articleUrl?: string): string | undefined {
  if (!articleUrl) return undefined;
  try {
    const title = decodeURIComponent(new URL(articleUrl).pathname.replace(/^\/wiki\//, "")).replace(/_/g, " ").trim();
    return title || undefined;
  } catch {
    return undefined;
  }
}

/** `http://commons.wikimedia.org/wiki/Special:FilePath/<name>` → https URL + file page, for re-hostable raster files only. */
export function commonsImage(filePath?: string): { url: string; pageUrl: string } | null {
  if (!filePath) return null;
  try {
    const u = new URL(filePath);
    if (!/(^|\.)commons\.wikimedia\.org$/.test(u.hostname)) return null;
    const m = /^\/wiki\/Special:FilePath\/(.+)$/.exec(u.pathname);
    if (!m) return null;
    const name = decodeURIComponent(m[1]);
    if (!IMAGE_EXT.test(name)) return null;
    const encoded = encodeURIComponent(name.replace(/ /g, "_"));
    return {
      url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}`,
      pageUrl: `https://commons.wikimedia.org/wiki/File:${encoded}`,
    };
  } catch {
    return null;
  }
}

export function parseRegions(isos?: string): string[] {
  if (!isos) return [];
  return [...new Set(isos.split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s)))].sort();
}

/** One SPARQL binding → the N-year anniversary row, or null when a guard rejects it. */
export function bindingToEvent(b: SparqlBinding, n: number, now: Date): IngestEvent | null {
  const iri = b.item?.value ?? "";
  const qid = iri.split("/").pop() ?? "";
  if (!/^Q\d+$/.test(qid)) return null;
  const label = sanitizeTitle(b.itemLabel?.value ?? "");
  if (!label || /^Q\d+$/.test(label)) return null;
  if (precisionFromWikidata(Number(b.prec?.value)) !== "day") return null;
  const gregorian = parseYmd(b.d?.value ?? "");
  if (!gregorian || gregorian.y < 1) return null;
  const julian = b.cal?.value === JULIAN_MODEL;
  const original = julian ? gregorianToJulian(gregorian) : gregorian;
  if (!labelYearConsistent(label, original.y)) return null;
  const enwiki = enwikiTitle(b.enwiki?.value);
  if (!enwiki) return null;
  const sitelinks = Number(b.sl?.value);
  if (!Number.isFinite(sitelinks) || sitelinks <= MIN_SITELINKS) return null;

  const anniversary = addYears(original, n);
  const date = ymdToIso(anniversary);
  const tags = ["anniversary", `anniversary-${n}`, ...classify(label, "history").tags];
  if (!isFutureOrFar(date, "day", now) || isFarFuture(date, tags, now)) return null;

  const originalIso = ymdToIso(original);
  const title = `${ordinal(n)} anniversary of ${label}`;
  // Three sentences, so even a two-word label clears the 80-character indexability bar
  // ("25 years since Live 8 (2 July 2005). The 25th anniversary falls on 2 July 2030." is 79).
  const description =
    `${n} years since ${label} (${longDate(original)}). ` +
    `The ${ordinal(n)} anniversary falls on ${longDate(anniversary)}${julian ? ", counted on the Julian-calendar date recorded for the event" : ""}. ` +
    `The date comes from the Wikidata record for the original event.`;
  const popularity = clamp(Math.floor(sitelinks / 2), 20, 70) + (MARQUEE.has(n) ? 10 : 0);
  const image = commonsImage(b.image?.value);
  const row = buildEvent({
    title,
    date,
    category: "history",
    tags,
    regions: parseRegions(b.isos?.value),
    description,
    source: "anniversaries",
    sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
    sourceKey: `anniversaries:${qid}:${anniversary.y}`,
    popularity,
    datePrecision: "day",
    status: "scheduled",
    confidence: 0.85,
    externalIds: { qid, enwiki, original_date: originalIso, anniversary_years: n, ...(julian ? { calendar: "julian" } : {}) },
    raw: {
      qid,
      label: b.itemLabel?.value,
      d: b.d?.value,
      prec: b.prec?.value,
      cal: julian ? "julian" : "gregorian",
      sl: b.sl?.value,
      enwiki: b.enwiki?.value,
      image: b.image?.value,
      isos: b.isos?.value || undefined,
    },
  });
  if (image) {
    row.image_candidate_url = image.url;
    row.image_candidate_meta = { provider: "commons", pageUrl: image.pageUrl };
  }
  return row;
}

/** Rows from one page, one per QID (bindings arrive date-ordered, so the earliest P585 wins). */
export function bindingsToEvents(bindings: SparqlBinding[], n: number, now: Date): IngestEvent[] {
  const byQid = new Map<string, IngestEvent>();
  for (const b of bindings) {
    const ev = bindingToEvent(b, n, now);
    if (!ev) continue;
    const qid = String(ev.external_ids.qid);
    if (!byQid.has(qid)) byQid.set(qid, ev);
  }
  return [...byQid.values()];
}

// ── Plan / run ────────────────────────────────────────────────────────────────────────────────

export type Cursor = { n: AnniversaryYears; from: string };
type AnnivUnit = Unit & { n: AnniversaryYears; from: string; to: string; lastDate: string | null; full: boolean };

function isAnniversaryYears(n: unknown): n is AnniversaryYears {
  return typeof n === "number" && (ANNIVERSARY_YEARS as readonly number[]).includes(n);
}

export function parseCursor(cursor: Json | null, now: Date): Cursor {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { n?: unknown; from?: unknown };
    if (isAnniversaryYears(c.n) && typeof c.from === "string" && parseYmd(c.from)) return { n: c.n, from: c.from.slice(0, 10) };
  }
  return { n: ANNIVERSARY_YEARS[0], from: originalWindow(ANNIVERSARY_YEARS[0], now).from };
}

function nextN(n: AnniversaryYears): AnniversaryYears | null {
  const i = ANNIVERSARY_YEARS.indexOf(n);
  return i >= 0 && i + 1 < ANNIVERSARY_YEARS.length ? ANNIVERSARY_YEARS[i + 1] : null;
}

/** The next slice at or after the cursor, skipping N values whose window is exhausted; null when the pass is over. */
export function nextSlice(cursor: Cursor, now: Date): { n: AnniversaryYears; from: string; to: string } | null {
  let n: AnniversaryYears | null = cursor.n;
  let from = cursor.from;
  while (n !== null) {
    const win = originalWindow(n, now);
    if (from < win.from) from = win.from;
    if (from < win.to) {
      const start = parseYmd(from)!;
      const sliceEnd = ymdToIso(addYears(start, sliceYears(n)));
      return { n, from, to: sliceEnd < win.to ? sliceEnd : win.to };
    }
    n = nextN(n);
    from = n === null ? from : originalWindow(n, now).from;
  }
  return null;
}

export const adapter: Adapter<AnnivUnit> = {
  id: "anniversaries",
  label: "Wikidata anniversaries",
  rank: 2,
  cadence: "weekly",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 5000, timeoutMs: 65_000, maxRetries: 3 }, // WDQS: serial, 60 s kill, 502/504 retried

  async plan(cursor, ctx): Promise<Plan<AnnivUnit>> {
    const slice = nextSlice(parseCursor(cursor, ctx.now), ctx.now);
    if (!slice) return { units: [], done: true };
    const { n, from, to } = slice;
    const unit: AnnivUnit = {
      key: `anniversaries:${n}:${from}`,
      label: `${n}-year anniversaries, originals ${from}..${to}`,
      n,
      from,
      to,
      lastDate: null,
      full: false,
      // Read by the runner after run(): a full page resumes from the last date it returned
      // (the boundary day is re-queried, its rows simply upsert again); otherwise the next slice.
      get after(): Json {
        if (this.full && this.lastDate && this.lastDate > from) return { n, from: this.lastDate };
        if (to < originalWindow(n, ctx.now).to) return { n, from: to };
        const next = nextN(n);
        return next === null ? { n, from: to } : { n: next, from: originalWindow(next, ctx.now).from };
      },
    };
    return {
      units: [unit],
      done: false,
      get nextCursor(): Json {
        return unit.after;
      },
    };
  },

  async run(unit, ctx) {
    let to = unit.to;
    for (;;) {
      const narrowable = halveWindow(unit.from, to) !== null;
      try {
        const query = buildAnniversaryQuery(unit.from, to, PAGE_LIMIT);
        const url = `${WD_ENDPOINT}?query=${encodeURIComponent(query)}`;
        const json = await ctx.http.fetchJson<{ results?: { bindings?: SparqlBinding[] } }>(url, {
          headers: { Accept: "application/sparql-results+json" },
          // While the slice can still be narrowed, a 504 is answered by halving rather than by
          // re-sending the same doomed query; at the floor one retry is worth it because there a
          // 502/504 really can be transient.
          maxRetries: narrowable ? 0 : 1,
        });
        const bindings = json?.results?.bindings ?? [];
        const lastDate = bindings.length ? (bindings[bindings.length - 1].d?.value ?? "").slice(0, 10) || null : null;
        const pageFull = bindings.length >= PAGE_LIMIT;
        const narrowed = to < unit.to;
        // Resume from the last date actually covered: the last binding when the page filled up,
        // else the end of the narrowed window, else nothing (the whole slice was covered).
        const resume = pageFull && lastDate && lastDate > unit.from ? lastDate : narrowed ? to : null;
        unit.full = resume !== null;
        unit.lastDate = resume;
        if (pageFull) ctx.log.warn(`${unit.label}: page limit ${PAGE_LIMIT} reached; resuming from ${resume}`);
        else if (narrowed) ctx.log.warn(`${unit.label}: answered only up to ${to}; resuming there`);
        const rows = bindingsToEvents(bindings, unit.n, ctx.now);
        ctx.log.info(`${unit.label}: ${bindings.length} bindings${narrowed ? ` (originals ${unit.from}..${to})` : ""}, ${rows.length} kept`);
        return rows;
      } catch (err) {
        const half = isSliceTooWide(err) ? halveWindow(unit.from, to) : null;
        if (!half) throw err;
        ctx.log.warn(`${unit.label}: ${(err as Error).message}; narrowing to ${unit.from}..${half}`);
        to = half;
      }
    }
  },
};
