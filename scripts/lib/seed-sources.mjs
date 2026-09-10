/**
 * Catalog source loaders for Until.
 *
 *  - holidays:  date-holidays npm package (fully offline)
 *  - curated:   scripts/curated.mjs (CURATED + recurring astronomy/culture)
 *  - wikidata:  SPARQL with a precision guard (no fake January 1 dates)
 *  - wikipedia: year pages (2026, 2027, …) parsed for "Month D – Title" lines
 *
 * Every network loader fails soft: it logs and returns [] so one outage never
 * empties a run. Helper semantics (slugify, classify, makeEvent, mergeAll…)
 * are ported from the retired scripts/seed.mjs.
 */

import Holidays from "date-holidays";
import { CURATED, RECURRING_ASTRONOMY, RECURRING_CULTURE } from "../curated.mjs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOW_YEAR = new Date().getUTCFullYear();

/** Catalog window: this year .. +6 (7 years), computed from the clock. */
export const YEARS = Array.from({ length: 7 }, (_, i) => NOW_YEAR + i);

export const UA =
  process.env.INGEST_USER_AGENT ||
  "UntilCountdowns/2.0 (https://github.com/danyeldev/until-countdowns; catalog seed)";

export const TAG_RULES = [
  [/christmas|navidad|weihnachten|no[eë]l|bo[zż]e|natal|xmas/i, "holidays", ["christmas", "religious"]],
  [/boxing day/i, "holidays", ["christmas"]],
  [/new year|a[nñ]o nuevo|nouvel an|neujahr|ano novo|hogmanay/i, "holidays", ["new-year"]],
  [/easter|pascua|ostern|p[aá]scoa|p[âa]ques|pasqua/i, "holidays", ["easter", "religious"]],
  [/good friday|holy (thursday|saturday)|ascension|pentecost|whit|maundy|corpus christi|assumption|immaculate|epiphany|three kings|all saints|all souls/i, "holidays", ["religious", "christian"]],
  [/ramadan|eid|eid[ -]?al|islamic|mawlid|muharram|prophet/i, "holidays", ["religious", "islamic"]],
  [/hanukkah|passover|yom kippur|rosh hash|purim|sukkot|shavuot/i, "holidays", ["religious", "jewish"]],
  [/diwali|holi|dussehra|navaratri|vesak|buddha|vesakha/i, "holidays", ["religious"]],
  [/independence|national day|republic day|liberation|revolution day|constitution|unification|foundation day|statehood/i, "holidays", ["national"]],
  [/labou?r|workers|may day/i, "holidays", ["labor"]],
  [/thanksgiving/i, "holidays", ["thanksgiving"]],
  [/halloween|d[ií]a de (los )?muertos|day of the dead/i, "culture", ["halloween"]],
  [/memorial|armistice|veterans|remembrance|anzac|victory day|heroes/i, "holidays", ["remembrance"]],
  [/\b(king|queen|sultan|emperor|birthday of|royal)\b/i, "holidays", ["royal"]],
  [/valentine/i, "culture", ["romance"]],
  [/women'?s day/i, "culture", ["social"]],
  [/earth day|environment|ocean/i, "nature", ["earth"]],
  [/children|youth|family/i, "culture", ["family"]],
  [/olympi|world cup|super bowl|grand slam|grand prix|championship|tournament|marathon|wimbledon|tour de france/i, "sports", ["sports"]],
  [/eclipse|equinox|solstice|meteor|comet|transit of/i, "astronomy", ["sky"]],
  [/election|inauguration|referendum/i, "politics", ["elections"]],
  [/ces\b|wwdc|google i\/o|re:invent|conference/i, "tech", ["conference"]],
];

export const FEATURED_NAMES =
  /christmas day|new year'?s (day|eve)|halloween|thanksgiving day|independence day|eid al-fitr|diwali|lunar new year|chinese new year/i;

/** Client-side source precedence; mirrors public.sources.rank for these ids. */
export const SOURCE_RANK = { curated: 9, wikipedia: 3, wikidata: 2, holidays: 1 };

const FAR_FUTURE_YEARS = 15;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function slugify(input) {
  return String(input)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function classify(name, fallback = "holidays") {
  for (const [re, category, tags] of TAG_RULES) {
    if (re.test(name)) return { category, tags: [...tags] };
  }
  return { category: fallback, tags: [] };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

export function isoDate(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseInstant(dateStr) {
  if (typeof dateStr !== "string") return NaN;
  return Date.parse(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00Z`);
}

/**
 * Exclusive end (ms) of the period a date covers at a given precision:
 * year precision `2026-01-01` covers all of 2026, month precision `2026-09-01`
 * covers all of September. Day/instant precision return the instant itself.
 */
export function precisionEnd(t, precision) {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  switch (precision) {
    case "decade":
      return Date.UTC(Math.floor(y / 10) * 10 + 10, 0, 1);
    case "year":
      return Date.UTC(y + 1, 0, 1);
    case "quarter":
      return Date.UTC(y, Math.floor(d.getUTCMonth() / 3) * 3 + 3, 1);
    case "month":
      return Date.UTC(y, d.getUTCMonth() + 1, 1);
    default:
      return t;
  }
}

/**
 * Keep anything from yesterday onward (includes "today"). Precision-aware:
 * a year-precision placeholder (YYYY-01-01) survives until the year ends,
 * a month-precision one (YYYY-MM-01) until the month ends.
 */
export function isFutureOrFar(dateStr, precision = "day") {
  const t = parseInstant(dateStr);
  if (Number.isNaN(t)) return false;
  return precisionEnd(t, precision) > Date.now() - 2 * 86400000;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchJson(url, { timeout = 20000, headers = {}, retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json", ...headers },
        signal: ctrl.signal,
      });
      if (res.status === 429 || res.status === 503) {
        const retryAfter = Number(res.headers.get("retry-after")) || 0;
        const wait = Math.max(retryAfter * 1000, 2000 * 2 ** attempt);
        console.warn(`  ${res.status} from ${new URL(url).host}; backing off ${wait}ms`);
        lastErr = new Error(`${res.status} ${res.statusText} for ${url}`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      await sleep(500 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = await fn(items[idx], idx);
      } catch (err) {
        out[idx] = { error: err };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Build a normalized in-memory event. Extra optional fields (datePrecision,
 * status, confidence, externalIds) are carried through to the push script.
 */
export function makeEvent({
  title,
  date,
  endDate,
  category,
  tags = [],
  regions = [],
  description = "",
  source,
  sourceUrl,
  featured = false,
  popularity = 20,
  allDay = true,
  datePrecision,
  status,
  confidence,
  externalIds,
}) {
  const day = date.slice(0, 10);
  const slug = `${slugify(title)}-${day}`;
  const ev = {
    id: slug,
    slug,
    title: String(title).trim(),
    description: String(description || "").trim(),
    date: allDay ? day : date,
    endDate: endDate ? (allDay ? endDate.slice(0, 10) : endDate) : undefined,
    allDay,
    category,
    tags: [...new Set(tags.map((t) => slugify(t)).filter(Boolean))],
    regions: [...new Set(regions.filter(Boolean))],
    source,
    sourceUrl,
    featured,
    popularity,
  };
  if (datePrecision) ev.datePrecision = datePrecision;
  if (status) ev.status = status;
  if (confidence !== undefined) ev.confidence = confidence;
  if (externalIds) ev.externalIds = externalIds;
  return ev;
}

/**
 * Merge lists by slug. Higher-rank source wins title/description/category/
 * date/precision; tags and regions are unioned; popularity is max; featured
 * is OR'd. Past events are dropped.
 */
export function mergeAll(lists) {
  const map = new Map();
  for (const list of lists) {
    for (const ev of list) {
      if (!ev?.date || !isFutureOrFar(ev.date, ev.datePrecision)) continue;
      const key = ev.slug || `${slugify(ev.title)}-${ev.date.slice(0, 10)}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...ev, tags: [...ev.tags], regions: [...ev.regions] });
        continue;
      }
      existing.regions = [...new Set([...existing.regions, ...ev.regions])];
      existing.tags = [...new Set([...existing.tags, ...ev.tags])];
      existing.popularity = Math.max(existing.popularity, ev.popularity);
      existing.featured = existing.featured || ev.featured;
      const incomingRank = SOURCE_RANK[ev.source] || 0;
      const existingRank = SOURCE_RANK[existing.source] || 0;
      // External ids must stay coherent with the winning title/sourceUrl: only a
      // strictly higher-rank source may override them; an equal-rank collision
      // (two Wikidata items with the same label + date) keeps the first item's.
      const hasExisting = existing.externalIds && Object.keys(existing.externalIds).length > 0;
      if (ev.externalIds && (incomingRank > existingRank || !hasExisting)) {
        const merged = { ...(existing.externalIds || {}), ...ev.externalIds };
        if (Object.keys(merged).length) existing.externalIds = merged;
        else delete existing.externalIds;
      }
      if (incomingRank > existingRank) {
        existing.title = ev.title;
        existing.description = ev.description || existing.description;
        existing.category = ev.category;
        existing.source = ev.source;
        existing.sourceUrl = ev.sourceUrl || existing.sourceUrl;
        existing.date = ev.date;
        existing.allDay = ev.allDay;
        existing.endDate = ev.endDate || existing.endDate;
        existing.datePrecision = ev.datePrecision;
        existing.status = ev.status;
        existing.confidence = ev.confidence;
        for (const k of ["datePrecision", "status", "confidence"]) {
          if (existing[k] === undefined) delete existing[k];
        }
      } else {
        if (!existing.description && ev.description) existing.description = ev.description;
        if (!existing.endDate && ev.endDate) existing.endDate = ev.endDate;
        if (!existing.sourceUrl && ev.sourceUrl) existing.sourceUrl = ev.sourceUrl;
        // An instant beats an all-day date from a lower-rank source (same rule as SQL).
        if (ev.date.includes("T") && !existing.date.includes("T")) {
          existing.date = ev.date;
          existing.allDay = false;
        }
      }
    }
  }
  return [...map.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
  );
}

// ---------------------------------------------------------------------------
// Curated + recurring
// ---------------------------------------------------------------------------

export function expandRecurring() {
  const events = [];
  const last = YEARS[YEARS.length - 1];
  const years = [...YEARS, last + 1, last + 2, last + 3];
  const featuredUntil = NOW_YEAR + 2;
  for (const year of years) {
    for (const r of RECURRING_ASTRONOMY) {
      events.push(
        makeEvent({
          title: r.title,
          date: isoDate(year, r.month, r.day),
          category: "astronomy",
          tags: r.tags,
          regions: ["GLOBAL"],
          description: r.description,
          source: "curated",
          featured: /perseid|geminid|solstice|equinox/i.test(r.title) && year <= featuredUntil,
          popularity: 58,
        }),
      );
    }
    for (const r of RECURRING_CULTURE) {
      events.push(
        makeEvent({
          title: r.title,
          date: isoDate(year, r.month, r.day),
          category: r.category || "culture",
          tags: r.tags,
          regions: ["GLOBAL"],
          description: r.description,
          source: "curated",
          featured: Boolean(r.featured) && year <= featuredUntil,
          popularity: r.popularity ?? 50,
        }),
      );
    }
  }
  return events;
}

/** Exact instant now + FAR_FUTURE_YEARS; the push script drops anything later unless tagged far-future. */
export function farFutureCutoffMs() {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + FAR_FUTURE_YEARS);
  return d.getTime();
}

export function expandCurated() {
  const farMs = farFutureCutoffMs();
  return CURATED.filter((e) => !e.skip && e.date && !e.date.includes("mid")).map((e) => {
    const { category, tags } = classify(e.title, e.category);
    const extra = parseInstant(e.date) > farMs ? ["far-future"] : [];
    return makeEvent({
      title: e.title,
      date: e.date,
      endDate: e.endDate,
      category: e.category || category,
      tags: [...(e.tags || []), ...tags, ...extra],
      regions: e.regions || ["GLOBAL"],
      description: e.description,
      source: "curated",
      sourceUrl: e.sourceUrl,
      featured: Boolean(e.featured),
      popularity: e.popularity ?? 70,
      allDay: e.allDay !== false,
    });
  });
}

// ---------------------------------------------------------------------------
// Holidays (date-holidays, offline)
// ---------------------------------------------------------------------------

const HOLIDAYS_SOURCE_URL = "https://github.com/commenthol/date-holidays";

/** { GLOBAL: 'Worldwide', AD: 'Andorra', … } — English names from date-holidays. */
export function loadCountryNames() {
  const hd = new Holidays();
  const countries = hd.getCountries("en") || {};
  const out = { GLOBAL: "Worldwide" };
  for (const code of Object.keys(countries).sort()) {
    out[code.toUpperCase()] = countries[code];
  }
  return out;
}

/**
 * Public holidays for every supported country and every year in YEARS,
 * merged across countries by slugify(name)|YYYY-MM-DD.
 */
export function loadHolidays() {
  let names;
  try {
    names = loadCountryNames();
  } catch (err) {
    console.warn("date-holidays: could not enumerate countries:", err.message);
    return [];
  }
  const codes = Object.keys(names).filter((c) => c !== "GLOBAL");
  console.log(`date-holidays: ${codes.length} countries × ${YEARS.length} years (offline)…`);

  const map = new Map();
  let raw = 0;
  let skippedCountries = 0;
  for (const code of codes) {
    let hd;
    try {
      hd = new Holidays(code, { languages: ["en"], types: ["public"] });
    } catch (err) {
      skippedCountries++;
      console.warn(`  ${code}: init failed (${err.message})`);
      continue;
    }
    for (const year of YEARS) {
      let list;
      try {
        list = hd.getHolidays(year) || [];
      } catch (err) {
        console.warn(`  ${code} ${year}: ${err.message}`);
        continue;
      }
      for (const h of list) {
        if (!h || h.substitute) continue;
        if (h.type && h.type !== "public") continue;
        const name = String(h.name || "").trim();
        if (!name) continue;
        const day = String(h.date || "").slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
        raw++;
        const key = `${slugify(name)}|${day}`;
        let ev = map.get(key);
        if (!ev) {
          const { category, tags } = classify(name, "holidays");
          const isFeatured = FEATURED_NAMES.test(name);
          ev = makeEvent({
            title: name,
            date: day,
            category: tags.includes("national") ? "national" : category,
            tags,
            regions: [code],
            description: "Public holiday.",
            source: "holidays",
            sourceUrl: HOLIDAYS_SOURCE_URL,
            featured: isFeatured,
            popularity: isFeatured ? 70 : 30,
            datePrecision: "day",
            status: "scheduled",
            confidence: 1.0,
          });
          map.set(key, ev);
        } else if (!ev.regions.includes(code)) {
          ev.regions.push(code);
        }
      }
    }
  }

  for (const ev of map.values()) {
    const n = ev.regions.length;
    ev.popularity = Math.min(99, ev.popularity + Math.floor(Math.log2(n + 1) * 8));
    if (n >= 25) ev.featured = true;
    if (n >= 8) {
      ev.description = `Observed in ${n} countries and territories.`;
    } else if (n === 1) {
      ev.description = `Public holiday in ${names[ev.regions[0]] || ev.regions[0]}.`;
    } else {
      const list = ev.regions.map((c) => names[c] || c).slice(0, 6);
      ev.description = `Observed in ${list.join(", ")}${n > 6 ? "…" : ""}.`;
    }
  }
  const events = [...map.values()];
  console.log(
    `date-holidays: ${raw} raw public holidays → ${events.length} merged` +
      (skippedCountries ? ` (${skippedCountries} countries skipped)` : ""),
  );
  return events;
}

// ---------------------------------------------------------------------------
// Wikidata (SPARQL with precision guard)
// ---------------------------------------------------------------------------

const WD_ENDPOINT = "https://query.wikidata.org/sparql";
const WD_PAGE = 3000;

/**
 * Class list. `prop` is the time property used for that class; `fallback`
 * is the category when classify() has no opinion. Q11446 (ship) was dropped:
 * it is not an event class. Q2761147 is "meeting" (summits, sessions).
 */
export const WIKIDATA_CLASSES = [
  { qid: "Q1656682", label: "planned event", prop: "P585", fallback: "culture" },
  { qid: "Q18608583", label: "recurring sporting event", prop: "P585", fallback: "sports", range: true },
  { qid: "Q16510064", label: "sporting event", prop: "P585", fallback: "sports", range: true },
  { qid: "Q11424", label: "film", prop: "P577", fallback: "film" },
  { qid: "Q500834", label: "tournament", prop: "P585", fallback: "sports", range: true },
  { qid: "Q13406554", label: "sports competition", prop: "P585", fallback: "sports", range: true },
  { qid: "Q40231", label: "public election", prop: "P585", fallback: "politics" },
  { qid: "Q1190554", label: "occurrence", prop: "P585", fallback: "culture" },
  { qid: "Q4504495", label: "award ceremony", prop: "P585", fallback: "entertainment" },
  { qid: "Q7889", label: "video game", prop: "P577", fallback: "games" },
  { qid: "Q132241", label: "festival", prop: "P585", fallback: "festivals", range: true },
  { qid: "Q2761147", label: "meeting", prop: "P585", fallback: "politics" },
];

const PRECISION = { 11: "day", 10: "month", 9: "year" };

function wikidataWindow() {
  const from = `${NOW_YEAR}-01-01T00:00:00Z`;
  const to = `${NOW_YEAR + FAR_FUTURE_YEARS}-01-01T00:00:00Z`;
  return { from, to };
}

/**
 * Build one SPARQL query. Uses the statement node so we get the stored
 * precision alongside the value; anything coarser than year (prec < 9) is
 * filtered out server-side. Joining `wdt:` on the same ?date restricts the
 * statement to the truthy value (preferred rank if any, else normal), so a
 * rescheduled event yields only its corrected date. Requires an enwiki sitelink.
 */
export function buildWikidataQuery({ qid, prop, withEnd = false, limit = WD_PAGE, offset = 0 }) {
  const { from, to } = wikidataWindow();
  const endClause = withEnd ? "  OPTIONAL { ?item wdt:P582 ?end . }\n" : "";
  const endVar = withEnd ? " ?end" : "";
  return `
SELECT DISTINCT ?item ?itemLabel ?date ?prec ?article${endVar} WHERE {
  ?item wdt:P31 wd:${qid} .
  ?item wdt:${prop} ?date .
  ?item p:${prop} ?st .
  ?st psv:${prop} ?v .
  ?v wikibase:timeValue ?date ;
     wikibase:timePrecision ?prec .
  FILTER(?prec >= 9 && ?date >= "${from}"^^xsd:dateTime && ?date < "${to}"^^xsd:dateTime)
  ?article schema:about ?item ;
           schema:isPartOf <https://en.wikipedia.org/> .
${endClause}  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?item ?date
LIMIT ${limit} OFFSET ${offset}`.trim();
}

export async function runSparql(query, { timeout = 90000 } = {}) {
  const url = `${WD_ENDPOINT}?query=${encodeURIComponent(query)}`;
  const json = await fetchJson(url, {
    timeout,
    retries: 4,
    headers: { Accept: "application/sparql-results+json" },
  });
  return json?.results?.bindings ?? [];
}

function enwikiTitle(articleUrl) {
  if (!articleUrl) return undefined;
  try {
    const path = new URL(articleUrl).pathname.replace(/^\/wiki\//, "");
    return decodeURIComponent(path).replace(/_/g, " ");
  } catch {
    return undefined;
  }
}

/**
 * Drop labels that mention a different year than the date (e.g. "Expo 2030"
 * dated 2027). A season range such as "2025–26" or "2026–2027" is consistent
 * when the date's year falls inside it.
 */
export function labelYearConsistent(label, dateYear) {
  const ranges = [];
  const rest = String(label).replace(
    /\b((?:19|20|21)\d{2})\s*[–—-]\s*(\d{4}|\d{2})\b/g,
    (_, a, b) => {
      const start = Number(a);
      let end = b.length === 4 ? Number(b) : Number(a.slice(0, 2) + b);
      if (end < start) end += 100; // "2099–00"
      ranges.push([start, end]);
      return " ";
    },
  );
  const years = rest.match(/\b(19|20|21)\d{2}\b/g) || [];
  if (!years.length && !ranges.length) return true;
  return (
    years.every((y) => Number(y) === dateYear) &&
    ranges.every(([start, end]) => dateYear >= start && dateYear <= end)
  );
}

/** Turn one SPARQL binding into an event (or null when it fails a guard). */
export function wikidataBindingToEvent(b, cls) {
  const iri = b.item?.value;
  const label = (b.itemLabel?.value || "").trim();
  const raw = b.date?.value;
  const prec = Number(b.prec?.value);
  if (!iri || !label || !raw) return null;
  if (/^Q\d+$/.test(label)) return null;
  const qid = iri.split("/").pop();
  const precision = PRECISION[prec];
  if (!precision) return null;
  const day = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const year = Number(day.slice(0, 4));
  if (!labelYearConsistent(label, year)) return null;
  // Keep the date exactly as Wikidata returns it (YYYY-01-01 for year precision,
  // YYYY-MM-01 for month precision). The UI renders "expected 2027" from precision.
  const imprecise = precision !== "day";
  const { category, tags } = classify(label, cls.fallback);
  const endRaw = b.end?.value;
  const endDate = endRaw && /^\d{4}-\d{2}-\d{2}/.test(endRaw) ? endRaw.slice(0, 10) : undefined;
  return makeEvent({
    title: label,
    date: day,
    endDate: endDate && endDate > day ? endDate : undefined,
    category,
    tags: [...tags, "wikidata"],
    regions: ["GLOBAL"],
    description: "Scheduled event from Wikidata.",
    source: "wikidata",
    sourceUrl: iri,
    popularity: 45,
    datePrecision: precision,
    status: imprecise ? "tentative" : "scheduled",
    confidence: imprecise ? 0.6 : 0.7,
    externalIds: { qid, enwiki: enwikiTitle(b.article?.value) },
  });
}

async function pageQuery(cls, { withEnd, limitPerPage = WD_PAGE, maxPages = 10 }) {
  const out = [];
  for (let page = 0; page < maxPages; page++) {
    const query = buildWikidataQuery({
      qid: cls.qid,
      prop: cls.prop,
      withEnd,
      limit: limitPerPage,
      offset: page * limitPerPage,
    });
    const bindings = await runSparql(query);
    out.push(...bindings);
    if (bindings.length < limitPerPage) break;
  }
  return out;
}

/**
 * Query Wikidata per class (no P279* traversal), paging with LIMIT/OFFSET.
 * One row per QID (earliest date wins). Fails soft per class.
 */
export async function loadWikidata({ classes = WIKIDATA_CLASSES, limitPerPage = WD_PAGE } = {}) {
  console.log(`Wikidata: ${classes.length} classes, ${limitPerPage}/page…`);
  const byQid = new Map();
  let bindings = 0;
  for (const cls of classes) {
    const variants = [{ withEnd: false }];
    if (cls.range) variants.push({ withEnd: true, startProp: "P580" });
    for (const variant of variants) {
      const effective = variant.startProp ? { ...cls, prop: variant.startProp } : cls;
      try {
        const rows = await pageQuery(effective, { withEnd: variant.withEnd, limitPerPage });
        bindings += rows.length;
        let kept = 0;
        for (const b of rows) {
          const ev = wikidataBindingToEvent(b, cls);
          if (!ev) continue;
          kept++;
          const qid = ev.externalIds.qid;
          const prev = byQid.get(qid);
          if (!prev || ev.date < prev.date) {
            if (prev?.endDate && !ev.endDate) ev.endDate = prev.endDate;
            byQid.set(qid, ev);
          } else if (prev && !prev.endDate && ev.endDate) {
            prev.endDate = ev.endDate;
          }
        }
        console.log(`  ${cls.qid} ${cls.label} [${effective.prop}]: ${rows.length} rows, ${kept} kept`);
      } catch (err) {
        console.warn(`  ${cls.qid} ${cls.label} [${effective.prop}] skipped: ${err.message}`);
      }
    }
  }
  const events = [...byQid.values()];
  console.log(`Wikidata: ${bindings} bindings → ${events.length} events`);
  return events;
}

// ---------------------------------------------------------------------------
// Wikipedia year pages
// ---------------------------------------------------------------------------

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export async function loadWikipediaYears({ years = YEARS } = {}) {
  const events = [];
  const re =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:\s*[–-]\s*(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+)?(\d{1,2}))?\s*[–—:]\s+([^<\n]{8,180})/gi;

  for (const year of years) {
    const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${year}&prop=text&format=json`;
    console.log(`Wikipedia ${year}…`);
    try {
      const json = await fetchJson(url, { timeout: 30000 });
      const html = json?.parse?.text?.["*"] || "";
      const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      let m;
      const seen = new Set();
      re.lastIndex = 0;
      while ((m = re.exec(text))) {
        const month = MONTHS[m[1].toLowerCase()];
        const day = Number(m[2]);
        if (!month || day < 1 || day > 31) continue;
        let title = m[5].replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
        title = title.replace(/\.$/, "");
        if (!title || title.length < 8) continue;
        if (/^In |^On |cite|ISBN|Retrieved|pp\.|archived/i.test(title)) continue;
        const date = isoDate(year, month, day);
        if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) continue;
        const key = `${slugify(title).slice(0, 40)}|${date}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const { category, tags } = classify(title, "culture");
        events.push(
          makeEvent({
            title,
            date,
            category,
            tags: [...tags, "wikipedia"],
            regions: ["GLOBAL"],
            description: `Listed among scheduled events for ${year} on Wikipedia.`,
            source: "wikipedia",
            sourceUrl: `https://en.wikipedia.org/wiki/${year}`,
            popularity: 40,
            datePrecision: "day",
            status: "scheduled",
            confidence: 0.8,
          }),
        );
      }
    } catch (err) {
      console.warn(`Wikipedia ${year} skipped:`, err.message);
    }
  }
  console.log(`Wikipedia: ${events.length} parsed events`);
  return events;
}
