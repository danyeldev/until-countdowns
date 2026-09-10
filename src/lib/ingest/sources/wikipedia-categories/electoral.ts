import { isoDate } from "../../normalize";

/**
 * Parser for the `YYYY national electoral calendar` wikitext. Only entries with a day and a
 * month are taken ("* 18 April: …", a multi-day "* 18–20 September: …" whose first day is the
 * date and last day the `endDate`, or a bare "* 18 April:" followed by "** …" sub-items);
 * month-only lines ("* March: …") and the "Unknown date" section carry no day and are skipped.
 * `<ref>`s, templates and italics are stripped before the links are read: the first
 * "Elections in X" / "Politics of X" / plain country link is the country, every link whose
 * target mentions an election(s) or referendum(s) is one entry (El Salvador lists a presidential and
 * a legislative election on the same day → two entries).
 */

export type ElectoralEntry = {
  /** First voting day. */
  date: string;
  /** Last voting day for multi-day votes ("18–20 September"), otherwise undefined. */
  endDate?: string;
  country: string;
  /** Article title as linked, e.g. "2027 French presidential election" or "Next Swiss federal election". */
  article: string;
  /** Link text, e.g. "President", "Parliament", "President and Congress". */
  office: string;
  /** The wiki marks some entries in italics (unrecognised states, disputed dates); kept for `raw`. */
  italic: boolean;
};

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const MONTH_RE = "(January|February|March|April|May|June|July|August|September|October|November|December)";
/** "* 18 April: …" or a multi-day "* 18–20 September: …" (first day is the event date). */
const DAY_LINE_RE = new RegExp(`^(\\*{1,3})\\s*(\\d{1,2})(?:\\s*[–—-]\\s*(\\d{1,2}))?\\s+${MONTH_RE}\\s*:?\\s*(.*)$`, "i");
const MONTH_LINE_RE = new RegExp(`^\\*{1,3}\\s*(?:(?:Early|Mid|Late|By|Before|After)\\s+)?${MONTH_RE}\\s*:`, "i");
const LINK_RE = /\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g;
const ELECTION_TARGET_RE = /\b(elections?|referendums?|plebiscites?|primar(?:y|ies))\b/i;
const COUNTRY_TARGET_RE = /^(?:Elections in|Politics of|Elections and referendums in|Referendums in)\s+(.+)$/i;

export function stripMarkup(s: string): string {
  let out = s
    .replace(/<ref[^>]*\/\s*>/gi, " ")
    .replace(/<ref[\s\S]*?<\/ref>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  // Templates, innermost first (two passes cover {{a|{{b}}}}).
  for (let i = 0; i < 3 && /\{\{/.test(out); i++) out = out.replace(/\{\{[^{}]*\}\}/g, " ");
  return out.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function links(text: string): Array<{ target: string; label: string }> {
  const out: Array<{ target: string; label: string }> = [];
  for (const m of text.matchAll(LINK_RE)) {
    const target = m[1].trim().replace(/_/g, " ");
    const label = (m[2] ?? m[1]).trim();
    if (target && !/^(File|Image|Category):/i.test(target)) out.push({ target, label });
  }
  return out;
}

function entriesFromLine(rest: string, date: string, endDate?: string): ElectoralEntry[] {
  const italic = /''/.test(rest);
  const text = stripMarkup(rest).replace(/'{2,}/g, "");
  const all = links(text);
  if (!all.length) return [];
  let country = "";
  const elections: Array<{ target: string; label: string }> = [];
  for (const l of all) {
    const cm = COUNTRY_TARGET_RE.exec(l.target);
    if (cm && !country) {
      country = l.label || cm[1];
      continue;
    }
    if (ELECTION_TARGET_RE.test(l.target)) {
      elections.push(l);
      continue;
    }
    if (!country) country = l.label;
  }
  if (!country) return [];
  country = country.replace(/^the\s+/i, "").trim();
  return elections.map((e) => ({ date, ...(endDate ? { endDate } : {}), country, article: e.target, office: e.label, italic }));
}

function validDay(year: number, month: number, day: number): boolean {
  if (day < 1 || day > 31) return false;
  const iso = isoDate(year, month, day);
  const t = Date.parse(`${iso}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).getUTCDate() === day;
}

/** Parse the calendar wikitext for `year`; entries without a day-precision date are skipped. */
export function parseElectoralCalendar(wikitext: string, year: number): ElectoralEntry[] {
  const out: ElectoralEntry[] = [];
  const seen = new Set<string>();
  let pending: { date: string; endDate?: string } | null = null;
  let section = "";
  for (const raw of wikitext.split(/\r?\n/)) {
    const line = raw.trim();
    const h = /^(={2,})\s*(.+?)\s*\1$/.exec(line);
    if (h) {
      section = h[2].toLowerCase();
      pending = null;
      continue;
    }
    if (!line.startsWith("*")) continue;
    if (/^(see also|references|external links|notes|unknown date)/.test(section)) continue;
    const dm = DAY_LINE_RE.exec(line);
    let date: string | null = null;
    let endDate: string | undefined;
    let rest = "";
    if (dm) {
      const month = MONTHS[dm[4].toLowerCase()];
      const day = Number(dm[2]);
      if (!month || !validDay(year, month, day)) continue;
      date = isoDate(year, month, day);
      const lastDay = dm[3] ? Number(dm[3]) : null;
      if (lastDay && lastDay > day && validDay(year, month, lastDay)) endDate = isoDate(year, month, lastDay);
      rest = dm[5] ?? "";
      pending = stripMarkup(rest).replace(/'{2,}/g, "").trim() ? null : { date, endDate };
      if (!pending && !rest.trim()) continue;
    } else if (MONTH_LINE_RE.test(line)) {
      pending = null;
      continue;
    } else if (pending && /^\*{2,}/.test(line)) {
      date = pending.date;
      endDate = pending.endDate;
      rest = line.replace(/^\*+\s*/, "");
    } else {
      pending = null;
      continue;
    }
    if (!date || !rest.trim()) continue;
    for (const e of entriesFromLine(rest, date, endDate)) {
      const key = `${e.article.toLowerCase()}|${e.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    }
  }
  return out;
}

/**
 * Display title for an entry: the article title, with a leading "Next" replaced by the calendar
 * year ("Next Swiss federal election" → "2027 Swiss federal election"). Returns null when the
 * title names a different year (a 2026 election listed on the 2027 page).
 */
export function electionTitle(article: string, year: number): string | null {
  let title = article.trim().replace(/^Next\s+/i, `${year} `);
  title = title.replace(/\s+\([^)]*\)$/, "").trim();
  const years = title.match(/\b(19|20|21)\d{2}\b/g) ?? [];
  if (years.some((y) => Number(y) !== year)) return null;
  if (!/^\d{4}\b/.test(title)) title = `${year} ${title}`;
  return title;
}

/** Election kind tag from the article title. */
export function electionKind(article: string): string | null {
  const m = /\b(presidential|parliamentary|legislative|general|federal|senate|referendums?|constitutional|gubernatorial|municipal|primar(?:y|ies))\b/i.exec(
    article,
  );
  if (m) {
    const k = m[1].toLowerCase();
    if (k.startsWith("referendum")) return "referendum";
    if (k.startsWith("primar")) return "primary";
    return k;
  }
  if (/\b(house of representatives|house of commons|chamber of deputies|national assembly|state duma|sejm)\b/i.test(article)) return "legislative";
  return null;
}
