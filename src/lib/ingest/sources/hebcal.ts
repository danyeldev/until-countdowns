import { buildEvent, isFutureOrFar, sanitizeTitle, slugify } from "../normalize";
import { addDaysIso } from "../recurrence";
import type { Adapter, IngestContext, IngestEvent, IngestLogger, Json, Plan, Unit } from "../types";

/**
 * Jewish holidays and fasts from the Hebcal REST API (https://www.hebcal.com/home/developer-apis).
 *
 * Coverage: major, minor and modern-Israeli holidays plus minor fasts, Diaspora calendar
 * (`i=off`: Pesach 8 days, Shavuot 2 days), for `now.year … now.year + 14`. One unit per Gregorian
 * year → one request each (≈ 30 KB), 15 requests per pass. No key, no registration.
 *
 * Licence (snapshot 2026-09-09, https://www.hebcal.com/home/developer-apis — Hebcal has no
 * versioned ToS page): "Hebcal holiday data is licensed under CC BY 4.0 … you are free to use it
 * for any purpose, even commercially, provided you give appropriate credit." The credit is stored
 * on `public.sources.attribution` ("Jewish holiday data from Hebcal.com (CC BY 4.0)") and must be
 * rendered on every page that shows a hebcal row. `memo` (the one- or two-sentence explanation) is
 * used as the description under that credit. Do NOT swap in `@hebcal/core` — it is GPL-2.0.
 *
 * Record shape: multi-day holidays arrive as one item per day ("Pesach I … Pesach VIII",
 * "Chanukah: 1 Candle … 8th Day", "Sukkot I … VII (Hoshana Raba)", "Rosh Hashana 5788" +
 * "Rosh Hashana II"). Items are grouped by the holiday's own page id — the `link` slug
 * `hebcal.com/h/<name>-<year>` — into one row: `date` = first day, `end_date` = last day. The slug's
 * year is the holiday's start year, so the "Chanukah: 8th Day" that lands on 1 January belongs to
 * the previous year's group and is skipped in the year it appears in; the group it belongs to gets
 * its end date from the fixed 8-day length instead. "Erev X" items become their own "X Eve" rows.
 * Observances that can fall twice in one Gregorian year (Asara B'Tevet, 10 Tevet) have date-keyed
 * pages (`hebcal.com/h/asara-btevet-<yyyymmdd>`) and keep the date in their id, so each occurrence
 * is its own row (`hebcal:2028:asara-btevet-20280109`, `hebcal:2028:asara-btevet-20281228`).
 *
 * Rejected alternatives (see the Phase-4 briefs, section 20): Nager.Date (ToS bans holiday
 * portals), Calendarific/HolidayAPI (paid, non-commercial free tiers), timeanddate.com (proprietary).
 *
 * Rate limit: HTTP 429 above ~90 requests per 10 s (documented); we send one request per second.
 */

export const HEBCAL_ENDPOINT = "https://www.hebcal.com/hebcal";
/** this year .. +14 (15 calls per pass). */
export const YEARS_AHEAD = 15;
const HANUKKAH_DAYS = 8;

export type HebcalItem = {
  title: string;
  date: string;
  hdate?: string;
  category: string;
  subcat?: string;
  hebrew?: string;
  memo?: string;
  link?: string;
  yomtov?: boolean;
  title_orig?: string;
};

export type HebcalResponse = {
  title?: string;
  date?: string;
  range?: { start: string; end: string };
  items?: HebcalItem[];
};

export type HebcalUnit = Unit & { year: number };
type Cursor = { afterYear: number };

export function hebcalUrl(year: number): string {
  const q = new URLSearchParams({
    v: "1",
    cfg: "json",
    maj: "on",
    min: "on",
    mod: "on",
    mf: "on",
    ss: "off",
    c: "off",
    s: "off",
    year: String(year),
    month: "x",
  });
  return `${HEBCAL_ENDPOINT}?${q.toString()}`;
}

/** English names used on the site where Hebcal's transliteration is not the common one. */
const DISPLAY_NAMES: Record<string, string> = {
  pesach: "Passover",
  chanukah: "Hanukkah",
  "rosh-hashana": "Rosh Hashanah",
  "tisha-bav": "Tisha B'Av",
};

const FEATURED_IDS = new Set(["rosh-hashana", "yom-kippur", "pesach", "chanukah"]);

const POPULARITY: Record<string, number> = { major: 55, modern: 35, minor: 30, fast: 25 };
const EREV_POPULARITY = 20;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Hebcal page link → `{ id, year, slug, url }`; null when the link has another shape.
 *
 * Most pages are year-keyed, `hebcal.com/h/<name>-<year>` → id `<name>` (`pesach`). A few observances
 * that can fall twice in one Gregorian year are date-keyed, `hebcal.com/h/<name>-<yyyymmdd>` (Asara
 * B'Tevet: `asara-btevet-20280109` and `asara-btevet-20281228`); their id keeps the date so the two
 * occurrences stay separate rows. `slug` is the full page slug (the last path segment) and `year`
 * the page's own start year in both shapes.
 */
export function parseLink(link: string | undefined): { id: string; year: number; slug: string; url: string } | null {
  if (!link) return null;
  try {
    const u = new URL(link);
    const m = /^\/h\/([a-z0-9-]+?)-(\d{4})(\d{4})?\/?$/.exec(u.pathname);
    if (!m) return null;
    const slug = m[3] ? `${m[1]}-${m[2]}${m[3]}` : `${m[1]}-${m[2]}`;
    const id = m[3] ? slug : m[1];
    return { id, year: Number(m[2]), slug, url: `${u.origin}${u.pathname}` };
  } catch {
    return null;
  }
}

/**
 * Strip the per-day decorations Hebcal adds to a holiday name: "Erev " prefix, roman-numeral day
 * ("Pesach VII", "Sukkot VII (Hoshana Raba)", "Pesach III (CH’’M)"), candle count
 * ("Chanukah: 3 Candles", "Chanukah: 8th Day") and the Hebrew year ("Rosh Hashana 5788").
 */
export function baseTitle(title: string): { base: string; erev: boolean } {
  let s = sanitizeTitle(title);
  const erev = /^erev\s+/i.test(s);
  if (erev) s = s.replace(/^erev\s+/i, "");
  s = s.replace(/:\s*\d+\s*candles?$/i, "").replace(/:\s*8th day$/i, "");
  s = s.replace(/\s*\((?:CH[’'"]{1,2}M|Hoshana Raba)\)\s*$/i, "");
  s = s.replace(/\s+(?:I{1,3}|IV|V|VI{1,3}|IX|X)$/, "");
  s = s.replace(/\s+5\d{3}$/, "");
  return { base: s.trim(), erev };
}

export type HebcalGroup = {
  /**
   * Holiday page id (`pesach`, or `asara-btevet-20280109` for date-keyed pages), prefixed `erev-`
   * for eve rows; the stable upstream id used in the source_key.
   */
  id: string;
  /** Year in the Hebcal page id, i.e. the holiday's own start year. */
  year: number;
  /** Full Hebcal page slug (`pesach-2027`, `asara-btevet-20280109`), the external id; null without a link. */
  slug: string | null;
  base: string;
  erev: boolean;
  subcat: string;
  memo: string;
  url: string | null;
  items: HebcalItem[];
};

/** Gregorian days between two ISO dates (b - a). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Group one year's items by holiday page id. Items whose page year is not `year` (spill-over days)
 * are dropped. Consecutive days share a group; a same-id item more than one day after the group's
 * last day (only possible for link-less items that fall back to the title slug, e.g. an observance
 * that occurs twice in one Gregorian year) starts a new date-keyed group instead of stretching the
 * row across the year.
 */
export function groupItems(items: readonly HebcalItem[], year: number, log?: IngestLogger): HebcalGroup[] {
  const groups = new Map<string, HebcalGroup>();
  let skippedCategory = 0;
  let skippedYear = 0;
  let spill = 0;
  for (const item of items) {
    if (!item || typeof item.title !== "string" || typeof item.date !== "string") continue;
    if (item.category !== "holiday") {
      skippedCategory++;
      continue;
    }
    const day = item.date.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number(day.slice(0, 4)) !== year) {
      skippedYear++;
      log?.warn(`hebcal ${year}: item outside the requested year skipped: ${item.title} ${item.date}`);
      continue;
    }
    const { base, erev } = baseTitle(item.title);
    if (!base) continue;
    const link = parseLink(item.link);
    const pageId = link?.id ?? slugify(base);
    const pageYear = link?.year ?? year;
    if (pageYear !== year) {
      spill++;
      continue;
    }
    let id = erev ? `erev-${pageId}` : pageId;
    const subcat = typeof item.subcat === "string" && item.subcat ? item.subcat : "minor";
    let g = groups.get(id);
    if (g) {
      const last = g.items[g.items.length - 1]?.date ?? day;
      if (daysBetween(last, day) > 1) {
        log?.warn(`hebcal ${year}: ${item.title} on ${day} is ${daysBetween(last, day)} days after the previous ${id} item (${last}); starting a separate row`);
        id = `${id}-${day.replace(/-/g, "")}`;
        g = groups.get(id);
      }
    }
    if (!g) {
      groups.set(id, {
        id,
        year,
        slug: link?.slug ?? null,
        base,
        erev,
        subcat,
        memo: (item.memo ?? "").trim(),
        url: link?.url ?? null,
        items: [{ ...item, date: day }],
      });
    } else {
      g.items.push({ ...item, date: day });
      if (!g.memo && item.memo) g.memo = item.memo.trim();
    }
  }
  for (const g of groups.values()) g.items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  log?.info(
    `hebcal ${year}: ${items.length} items → ${groups.size} holidays` +
      (skippedCategory ? ` (${skippedCategory} non-holiday items skipped)` : "") +
      (spill ? ` (${spill} spill-over days of the previous year skipped)` : "") +
      (skippedYear ? ` (${skippedYear} items outside ${year} skipped)` : ""),
  );
  return [...groups.values()];
}

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** Ensure a terminal period and count sentences. */
export function normalizeMemo(memo: string): { text: string; sentences: number } {
  let text = memo.replace(/\s+/g, " ").trim();
  if (!text) return { text: "", sentences: 0 };
  if (!/[.!?]$/.test(text)) text += ".";
  const sentences = (text.match(/[.!?](?=\s|$)/g) ?? []).length;
  return { text, sentences };
}

export function describe(g: HebcalGroup, date: string, endDate: string | null): string {
  const { text, sentences } = normalizeMemo(g.memo);
  const parts: string[] = [];
  if (text) parts.push(text);
  const holiday = DISPLAY_NAMES[g.id.replace(/^erev-/, "")] ?? g.base;
  if (g.erev) {
    parts.push(`${holiday} begins at sundown at the end of this day.`);
  } else if (g.id === "chanukah" && endDate) {
    // `date` is the day on whose evening the first candle is lit (Hebcal's "1 Candle" day), not
    // the day after sundown, so the generic "previous evening" sentence would be a day off.
    parts.push(`In ${g.year} the first candle is lit at nightfall on ${fmtDay(date)} and the eighth day falls on ${fmtDay(endDate)}.`);
  } else if (endDate) {
    parts.push(`In ${g.year} it runs from ${fmtDay(date)} to ${fmtDay(endDate)}, beginning at sundown the previous evening.`);
  } else if (sentences < 2 || text.length < 80) {
    // Below the indexability bar (two sentences and 80 characters) on the memo alone.
    parts.push("Observance begins at sundown the previous evening.");
    // Very short memos ("Fast of Esther") are still under the bar: add the date.
    if (parts.join(" ").length < 80) parts.push(`In ${g.year} it falls on ${fmtDay(date)}.`);
  }
  return parts.join(" ");
}

/** One holiday group → row, or null when it is already past. */
export function groupToEvent(g: HebcalGroup, now: Date): IngestEvent | null {
  const first = g.items[0];
  if (!first) return null;
  const date = first.date;
  let end: string | null = g.items.length > 1 ? g.items[g.items.length - 1].date : null;
  // Chanukah's last day may fall in the next Gregorian year (dropped from this year's response,
  // skipped as spill-over in the next): the festival is always eight days after the first candle.
  if (g.id === "chanukah") end = addDaysIso(date, HANUKKAH_DAYS);
  // Keep a multi-day holiday while it is in progress (a first pass during Passover still gets the row).
  if (!isFutureOrFar(end ?? date, "day", now)) return null;
  const name = DISPLAY_NAMES[g.id.replace(/^erev-/, "")] ?? g.base;
  const title = g.erev ? `${name} Eve` : name;
  const modern = g.subcat === "modern";
  const tags = ["jewish", "religious", "hebcal", "holiday", g.subcat];
  if (modern) tags.push("israel");
  if (g.erev) tags.push("erev");
  const popularity = g.erev ? EREV_POPULARITY : (POPULARITY[g.subcat] ?? 30);
  return buildEvent({
    title,
    date,
    endDate: end,
    category: "religion",
    tags,
    regions: modern ? ["GLOBAL", "IL"] : ["GLOBAL"],
    description: describe(g, date, end),
    source: "hebcal",
    sourceUrl: g.url,
    sourceKey: `hebcal:${g.year}:${g.id}`,
    featured: !g.erev && FEATURED_IDS.has(g.id),
    popularity,
    allDay: true,
    timezone: null,
    datePrecision: "day",
    status: "scheduled",
    confidence: 1,
    externalIds: g.slug ? { hebcal: g.erev ? `erev-${g.slug}` : g.slug } : {},
    seriesSlug: null,
    location: null,
    raw: {
      hebrew: first.hebrew ?? null,
      items: g.items.map((i) => ({ title: i.title, date: i.date, hdate: i.hdate ?? null, subcat: i.subcat ?? null, yomtov: i.yomtov ?? false })),
    },
  });
}

/** Rows for one year's response. */
export function itemsToEvents(items: readonly HebcalItem[], year: number, now: Date, log?: IngestLogger): IngestEvent[] {
  const rows: IngestEvent[] = [];
  const seen = new Set<string>();
  for (const g of groupItems(items, year, log)) {
    const ev = groupToEvent(g, now);
    if (!ev || seen.has(ev.source_key)) continue;
    seen.add(ev.source_key);
    rows.push(ev);
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.slug < b.slug ? -1 : 1));
  return rows;
}

export function parseCursor(cursor: Json | null): Cursor | null {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { afterYear?: unknown };
    if (typeof c.afterYear === "number" && Number.isInteger(c.afterYear)) return { afterYear: c.afterYear };
  }
  return null;
}

/** Years of a pass starting at `now`, minus those already upserted (`afterYear` and earlier). */
export function planUnits(now: Date, cursor: Json | null): HebcalUnit[] {
  const startYear = now.getUTCFullYear();
  const c = parseCursor(cursor);
  const from = c && c.afterYear >= startYear ? c.afterYear + 1 : startYear;
  const units: HebcalUnit[] = [];
  for (let year = from; year < startYear + YEARS_AHEAD; year++) {
    units.push({ key: `hebcal:${year}`, label: `Hebcal ${year}`, after: { afterYear: year }, year });
  }
  return units;
}

export const adapter: Adapter<HebcalUnit> = {
  id: "hebcal",
  label: "Hebcal (Jewish calendar)",
  rank: 5,
  cadence: "weekly",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 1000, timeoutMs: 20_000, maxRetries: 3 },

  async plan(cursor, ctx): Promise<Plan<HebcalUnit>> {
    return { units: planUnits(ctx.now, cursor), done: true };
  },

  async run(unit, ctx: IngestContext) {
    const json = await ctx.http.fetchJson<HebcalResponse>(hebcalUrl(unit.year));
    const items = Array.isArray(json?.items) ? json.items : [];
    if (!Array.isArray(json?.items)) ctx.log.warn(`${unit.label}: response has no items array`);
    const rows = itemsToEvents(items, unit.year, ctx.now, ctx.log);
    ctx.log.info(`${unit.label}: ${items.length} items, ${rows.length} rows`);
    return rows;
  },
};
