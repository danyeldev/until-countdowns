import { buildEvent, classify, decodeEntities, isFutureOrFar, isoDate, sanitizeTitle, slugify } from "../normalize";
import type { Adapter, IngestEvent, Json, Plan, Unit } from "../types";

/**
 * English Wikipedia year pages ("2026", "2027" …) via `action=parse` (CC BY-SA 4.0; attribution
 * "Text from Wikipedia" is on `public.sources`). Only list items of the form
 * "Month D – Title" are taken and the title is held to a strict quality bar (see `extractCandidates`):
 * clean text, one sentence, 8–90 chars, no forecast wording, looks like a name.
 */

const YEARS_AHEAD = 5; // this year .. +4
const MIN_LEN = 8;
const MAX_LEN = 90;
const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const MONTH_RE = "(January|February|March|April|May|June|July|August|September|October|November|December)";
const ITEM_RE = new RegExp(`^${MONTH_RE}\\s+(\\d{1,2})(?:\\s*[–—-]\\s*(?:${MONTH_RE}\\s+)?(\\d{1,2}))?\\s*[–—:]\\s+(.+)$`, "i");
/**
 * Year pages are written in the future tense ("The 2027 AFC Asian Cup is scheduled to be held in
 * Saudi Arabia…"); with a plain "drop forecast wording" rule nothing survives. The forecast verb is
 * therefore the cut point: the sentence subject is the title, the rest is discarded.
 */
// Case-sensitive on purpose: prose verbs on year pages are lowercase, while "May", "End", "Opens"
// inside a proper name ("World's End Day", "Eurovision Song Contest, May 15") must not cut.
const VERB_CUT_RE =
  /\s+(?:is|are|was|were|will|would|must|may|might|should|shall|takes? place|opens?|begins?|starts?|ends?|closes?|hosts?|celebrates?|marks?|becomes?|launches?|releases?)\b[\s\S]*$/;
const CLAUSE_CUT_RE = /,\s+(?:also|which|where|with|the|a|an|as|and|in|on|at|held|hosted|marking|celebrating)\b[\s\S]*$/i;
const FORECAST_RE = /will be|is expected|are expected|is scheduled|are scheduled|to be held|planned|announced|is due|are due|is set to|are set to/i;
const JUNK_RE = /^(in |on |if |unless |although |when |after |before |cite|isbn|retrieved|pp\.|archived)/i;

export type Candidate = { date: string; title: string; endDate?: string };

function firstSentence(s: string): string {
  const m = /^(.*?[.!?])(?:\s|$)/.exec(s);
  const first = m ? m[1] : s;
  return first.replace(/[.!?]+$/, "").trim();
}

/** Name-like tokens: capitalised words, four-digit years and ordinals ("71st"). */
function nameTokens(s: string): number {
  return (s.match(/(?:^|[\s(\-–"'/])(?:[A-Z][\w'’.-]*|\d{4}|\d+(?:st|nd|rd|th))(?=[\s,;:)"'/]|$)/g) ?? []).length;
}

/** The quality filter, exported for tests. Returns the cleaned title or null. */
export function cleanCandidate(raw: string): string | null {
  let t = sanitizeTitle(raw);
  t = firstSentence(t);
  if (JUNK_RE.test(t)) return null;
  t = t.replace(VERB_CUT_RE, "").replace(CLAUSE_CUT_RE, "").trim();
  t = t.replace(/^(?:the|an?)\s+/i, "").replace(/[,;:\s]+$/, "").trim();
  t = t.replace(/\s*\(([^()]*)\)\s*$/, (m, inner: string) => (/^\d{4}$/.test(inner.trim()) ? "" : m)).trim();
  if (t.length < MIN_LEN || t.length > MAX_LEN) return null;
  if (FORECAST_RE.test(t)) return null;
  if (/^[a-z]/.test(t)) return null;
  if (nameTokens(t) < 2) return null;
  if (/[<>{}|]/.test(t)) return null;
  return t;
}

/** Parse the `action=parse` HTML of a year page into (date, title) candidates. */
export function extractCandidates(html: string, year: number): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  // Each chunk is the text of one <li> up to its own </li> or the next nested <li>,
  // so a sub-list never bleeds into its parent line.
  const items = html.split(/<li\b[^>]*>/i).slice(1).map((chunk) => chunk.split(/<\/li>|<li\b/i)[0]);
  for (const li of items) {
    let text = li
      .replace(/<sup\b[^>]*class="[^"]*reference[^"]*"[^>]*>[\s\S]*?<\/sup>/gi, " ")
      .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    text = decodeEntities(text).replace(/\s+/g, " ").trim();
    const m = ITEM_RE.exec(text);
    if (!m) continue;
    const month = MONTHS[m[1].toLowerCase()];
    const day = Number(m[2]);
    if (!month || day < 1 || day > 31) continue;
    const date = isoDate(year, month, day);
    if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) continue;
    const title = cleanCandidate(m[5]);
    if (!title) continue;
    const key = `${slugify(title).slice(0, 60)}|${date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let endDate: string | undefined;
    if (m[4]) {
      const endMonth = m[3] ? MONTHS[m[3].toLowerCase()] : month;
      const endDay = Number(m[4]);
      if (endMonth && endDay >= 1 && endDay <= 31) endDate = isoDate(year, endMonth, endDay);
      if (endDate && endDate < date) endDate = undefined;
    }
    out.push({ date, title, endDate });
  }
  return out;
}

export function candidateToEvent(c: Candidate, year: number, now: Date): IngestEvent | null {
  if (!isFutureOrFar(c.date, "day", now)) return null;
  const { category, tags } = classify(c.title, "culture");
  return buildEvent({
    title: c.title,
    date: c.date,
    endDate: c.endDate,
    category,
    tags: [...tags, "wikipedia"],
    regions: ["GLOBAL"],
    description: `Listed among scheduled events for ${year} on Wikipedia.`,
    source: "wikipedia",
    sourceUrl: `https://en.wikipedia.org/wiki/${year}`,
    sourceKey: `wikipedia:${year}:${slugify(c.title).slice(0, 60)}`,
    popularity: 40,
    datePrecision: "day",
    status: "scheduled",
    confidence: 0.6,
  });
}

type WpUnit = Unit & { year: number };

function years(now: Date): number[] {
  const y = now.getUTCFullYear();
  return Array.from({ length: YEARS_AHEAD }, (_, i) => y + i);
}

export const adapter: Adapter<WpUnit> = {
  id: "wikipedia",
  label: "Wikipedia year pages",
  rank: 3,
  cadence: "daily",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 1000, timeoutMs: 30_000, maxRetries: 3 },

  async plan(cursor, ctx): Promise<Plan<WpUnit>> {
    const all = years(ctx.now);
    const from = cursor && typeof cursor === "object" && !Array.isArray(cursor) && typeof (cursor as { year?: unknown }).year === "number"
      ? Number((cursor as { year: number }).year)
      : all[0];
    const units: WpUnit[] = all
      .filter((y) => y >= from)
      .map((y) => ({ key: `wikipedia:${y}`, label: `year page ${y}`, after: { year: y + 1 } as Json, year: y }));
    return { units, done: true };
  },

  async run(unit, ctx) {
    const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${unit.year}&prop=text&format=json&formatversion=2&redirects=1`;
    const json = await ctx.http.fetchJson<{ parse?: { text?: string }; error?: { info?: string } }>(url);
    if (json.error) throw new Error(`Wikipedia ${unit.year}: ${json.error.info ?? "error"}`);
    const html = json.parse?.text ?? "";
    const candidates = extractCandidates(html, unit.year);
    const rows: IngestEvent[] = [];
    for (const c of candidates) {
      const ev = candidateToEvent(c, unit.year, ctx.now);
      if (ev) rows.push(ev);
    }
    ctx.log.info(`${unit.label}: ${candidates.length} candidates, ${rows.length} future rows`);
    return rows;
  },
};
