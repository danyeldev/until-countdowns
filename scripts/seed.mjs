#!/usr/bin/env node
/**
 * Build the Until catalog:
 *  1. Public holidays worldwide via Nager.Date
 *  2. Recurring astronomy + culture dates
 *  3. Curated notable future events
 *  4. Wikidata scheduled events (best-effort)
 *  5. Wikipedia year-page scheduled events (best-effort)
 *
 * Then classify, tag, merge duplicates, and write src/data/events.json
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CURATED, RECURRING_ASTRONOMY, RECURRING_CULTURE } from "./curated.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "src/data/events.json");
const COUNTRIES_OUT = resolve(ROOT, "src/data/countries.json");

const YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032];
const UA = "UntilCountdowns/1.0 (https://github.com/danyeldev/until-countdowns; catalog seed)";

const TAG_RULES = [
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

const FEATURED_NAMES =
  /christmas day|new year'?s (day|eve)|halloween|thanksgiving day|independence day|eid al-fitr|diwali|lunar new year|chinese new year/i;

function slugify(input) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function classify(name, fallback = "holidays") {
  for (const [re, category, tags] of TAG_RULES) {
    if (re.test(name)) return { category, tags: [...tags] };
  }
  return { category: fallback, tags: [] };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function isoDate(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function isFutureOrNear(dateStr) {
  const t = Date.parse(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00Z`);
  if (Number.isNaN(t)) return false;
  return t > Date.now() - 2 * 86400000;
}

async function fetchJson(url, { timeout = 20000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, { timeout = 25000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function pool(items, limit, fn) {
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

function makeEvent({
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
}) {
  const day = date.slice(0, 10);
  const slug = `${slugify(title)}-${day}`;
  return {
    id: slug,
    slug,
    title: title.trim(),
    description: description.trim(),
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
}

async function loadCountries() {
  const list = await fetchJson("https://date.nager.at/api/v3/AvailableCountries");
  return list;
}

async function loadNager(countries) {
  const jobs = [];
  for (const c of countries) {
    for (const year of YEARS) {
      jobs.push({ code: c.countryCode, year });
    }
  }
  console.log(`Nager.Date: ${jobs.length} country-year requests…`);
  const rows = [];
  let ok = 0;
  let fail = 0;
  const results = await pool(jobs, 10, async ({ code, year }) => {
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${code}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data = await fetchJson(url, { timeout: 15000 });
        ok++;
        if (ok % 100 === 0) console.log(`  nager ${ok}/${jobs.length}`);
        return data;
      } catch (err) {
        if (attempt === 2) {
          fail++;
          return [];
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    return [];
  });
  for (const data of results) {
    if (Array.isArray(data)) rows.push(...data);
  }
  console.log(`Nager.Date: ${rows.length} raw holidays (${ok} ok, ${fail} failed)`);
  return rows;
}

function mergeNager(rows, countryNames) {
  const map = new Map();
  for (const row of rows) {
    if (!row?.date || !row?.name) continue;
    const { category, tags } = classify(row.name, "holidays");
    const key = `${slugify(row.name)}|${row.date}`;
    let ev = map.get(key);
    if (!ev) {
      ev = makeEvent({
        title: row.name,
        date: row.date,
        category,
        tags,
        regions: [row.countryCode],
        description: row.localName && row.localName !== row.name
          ? `Also known as ${row.localName}.`
          : "Public holiday.",
        source: "nager",
        sourceUrl: "https://date.nager.at/",
        featured: FEATURED_NAMES.test(row.name),
        popularity: FEATURED_NAMES.test(row.name) ? 70 : 30,
      });
      map.set(key, ev);
    } else {
      if (!ev.regions.includes(row.countryCode)) ev.regions.push(row.countryCode);
      if (row.localName && row.localName !== row.name && !ev.description.includes(row.localName)) {
        // keep first local name mention only
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
      const name = countryNames.get(ev.regions[0]) || ev.regions[0];
      ev.description = `Public holiday in ${name}.`;
    } else {
      const names = ev.regions.map((c) => countryNames.get(c) || c).slice(0, 6);
      ev.description = `Observed in ${names.join(", ")}${n > 6 ? "…" : ""}.`;
    }
  }
  return [...map.values()];
}

function expandRecurring() {
  const events = [];
  const years = [...YEARS, 2033, 2034, 2035];
  for (const year of years) {
    for (const r of RECURRING_ASTRONOMY) {
      const date = isoDate(year, r.month, r.day);
      events.push(
        makeEvent({
          title: r.title,
          date,
          category: "astronomy",
          tags: r.tags,
          regions: ["GLOBAL"],
          description: r.description,
          source: "curated",
          featured: /perseid|geminid|solstice|equinox/i.test(r.title) && year <= 2028,
          popularity: 58,
        }),
      );
    }
    for (const r of RECURRING_CULTURE) {
      const date = isoDate(year, r.month, r.day);
      events.push(
        makeEvent({
          title: r.title,
          date,
          category: r.category || "culture",
          tags: r.tags,
          regions: ["GLOBAL"],
          description: r.description,
          source: "curated",
          featured: Boolean(r.featured) && year <= 2028,
          popularity: r.popularity ?? 50,
        }),
      );
    }
  }
  return events;
}

function expandCurated() {
  return CURATED.filter((e) => !e.skip && e.date && !e.date.includes("mid")).map((e) => {
    const { category, tags } = classify(e.title, e.category);
    return makeEvent({
      title: e.title,
      date: e.date,
      endDate: e.endDate,
      category: e.category || category,
      tags: [...(e.tags || []), ...tags],
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

async function loadWikidata() {
  const query = `
SELECT DISTINCT ?item ?itemLabel ?date WHERE {
  VALUES ?type {
    wd:Q1656682 wd:Q18608583 wd:Q16510064 wd:Q11424
    wd:Q500834 wd:Q13406554 wd:Q40231 wd:Q11446
  }
  ?item wdt:P31 ?type .
  ?item wdt:P585 ?date .
  FILTER(?date >= "2026-01-01T00:00:00Z"^^xsd:dateTime && ?date < "2038-01-01T00:00:00Z"^^xsd:dateTime)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 2500`.trim();
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
  console.log("Wikidata SPARQL…");
  try {
    const json = await fetchJson(url, { timeout: 45000 });
    const bindings = json?.results?.bindings ?? [];
    const events = [];
    for (const b of bindings) {
      const title = b.itemLabel?.value;
      const date = b.date?.value;
      const iri = b.item?.value;
      if (!title || !date || title.startsWith("Q")) continue;
      const day = date.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const { category, tags } = classify(title, "culture");
      events.push(
        makeEvent({
          title,
          date: day,
          category,
          tags: [...tags, "wikidata"],
          regions: ["GLOBAL"],
          description: "Scheduled event from Wikidata.",
          source: "wikidata",
          sourceUrl: iri,
          popularity: 45,
        }),
      );
    }
    console.log(`Wikidata: ${events.length} events`);
    return events;
  } catch (err) {
    console.warn("Wikidata skipped:", err.message);
    return [];
  }
}

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

async function loadWikipediaYears() {
  const events = [];
  const re =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:\s*[–-]\s*(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+)?(\d{1,2}))?\s*[–—:]\s+([^<\n]{8,180})/gi;

  for (const year of [2026, 2027, 2028, 2029, 2030]) {
    const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${year}&prop=text&format=json`;
    console.log(`Wikipedia ${year}…`);
    try {
      const json = await fetchJson(url, { timeout: 30000 });
      const html = json?.parse?.text?.["*"] || "";
      const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      let m;
      const seen = new Set();
      while ((m = re.exec(text))) {
        const month = MONTHS[m[1].toLowerCase()];
        const day = Number(m[2]);
        let title = m[5].replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
        title = title.replace(/\.$/, "");
        if (!title || title.length < 8) continue;
        if (/^In |^On |cite|ISBN|Retrieved|pp\.|archived/i.test(title)) continue;
        const date = isoDate(year, month, day);
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
            popularity: 48,
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

function mergeAll(lists) {
  const map = new Map();
  const sourceRank = { curated: 4, wikipedia: 3, wikidata: 2, nager: 1 };
  for (const list of lists) {
    for (const ev of list) {
      if (!isFutureOrFar(ev.date)) continue;
      const key = `${slugify(ev.title)}|${ev.date.slice(0, 10)}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, ev);
        continue;
      }
      // Prefer richer / curated records; union regions and tags
      existing.regions = [...new Set([...existing.regions, ...ev.regions])];
      existing.tags = [...new Set([...existing.tags, ...ev.tags])];
      existing.popularity = Math.max(existing.popularity, ev.popularity);
      existing.featured = existing.featured || ev.featured;
      if ((sourceRank[ev.source] || 0) > (sourceRank[existing.source] || 0)) {
        existing.title = ev.title;
        existing.description = ev.description || existing.description;
        existing.category = ev.category;
        existing.source = ev.source;
        existing.sourceUrl = ev.sourceUrl || existing.sourceUrl;
        existing.endDate = ev.endDate || existing.endDate;
      } else if (!existing.description && ev.description) {
        existing.description = ev.description;
      }
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

function isFutureOrFar(dateStr) {
  const t = Date.parse(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00Z`);
  if (Number.isNaN(t)) return false;
  // Keep anything from yesterday onward (include "today")
  return t > Date.now() - 2 * 86400000;
}

function summarize(events) {
  const byCat = {};
  const bySrc = {};
  for (const e of events) {
    byCat[e.category] = (byCat[e.category] || 0) + 1;
    bySrc[e.source] = (bySrc[e.source] || 0) + 1;
  }
  return { byCat, bySrc, featured: events.filter((e) => e.featured).length };
}

async function main() {
  const countries = await loadCountries();
  const countryNames = new Map(countries.map((c) => [c.countryCode, c.name]));
  await mkdir(resolve(ROOT, "src/data"), { recursive: true });
  await writeFile(
    COUNTRIES_OUT,
    JSON.stringify(
      { GLOBAL: "Worldwide", ...Object.fromEntries(countryNames) },
      null,
      2,
    ),
  );

  const [nagerRows, wikiEvents, wdEvents] = await Promise.all([
    loadNager(countries),
    loadWikipediaYears(),
    loadWikidata(),
  ]);

  const nagerEvents = mergeNager(nagerRows, countryNames);
  const recurring = expandRecurring();
  const curated = expandCurated();

  const events = mergeAll([nagerEvents, recurring, curated, wikiEvents, wdEvents]);
  const stats = summarize(events);

  const payload = {
    generatedAt: new Date().toISOString(),
    count: events.length,
    sources: ["nager", "curated", "wikipedia", "wikidata"],
    stats,
    events,
  };

  await writeFile(OUT, JSON.stringify(payload));
  console.log(`Wrote ${events.length} events → ${OUT}`);
  console.log(stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
