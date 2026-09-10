import { createHash } from "node:crypto";
import { catalogDay } from "@/lib/time";
import { CATEGORIES, type Category } from "@/lib/types";
import type { IngestEvent, IngestPrecision, IngestStatus } from "./types";

/**
 * Pure normalisation helpers, ported from scripts/lib/seed-sources.mjs and
 * scripts/push-catalog.mjs so the cron adapters produce byte-identical slugs,
 * source_keys and content hashes to the rows the push script loaded.
 */

export const FAR_FUTURE_YEARS = 15;
export const TITLE_MIN = 2;
export const TITLE_MAX = 200;

/**
 * Per-tag and per-row tag caps, mirroring `IngestEventSchema.tags` in ./types.ts
 * (`z.array(z.string().min(1).max(60)).max(40)`). They live here because `buildEvent` has to
 * enforce them itself: slugify() caps a tag at 80 characters, 20 past what the schema accepts, and
 * `prepareRows` (./upsert.ts) drops a row that fails validation *whole* — so one over-long facet
 * costs the countdown, not the facet. How often a live adapter actually hands buildEvent a name
 * that long was not measured (no network here): this is a guard against a shape the schema
 * rejects, not a fix for a failure anyone watched. Keep in step with types.ts; the boundary test
 * in tests/ingest/normalize.test.ts pins the two together.
 */
export const TAG_MAX = 60;
export const TAGS_MAX = 40;

export type TagRule = [RegExp, Category, string[]];

/**
 * Title → (category, tags); first match wins, so the order of the list is load-bearing.
 *
 * These regexes see a bare title and nothing else, from every adapter: a holiday name, a UFC
 * card, an album, a tour, a venue. An unanchored token is therefore a bug and not a shortcut —
 * `whit` matched "Robert Whittaker", `ces` matched "Armed Forces Day", `easter` matched
 * "Eastern Conference Finals", `natal` matched "Natalicio de Benito Juárez". Two rules keep the
 * tokens honest:
 *   1. anchor on word boundaries, never on a bare substring;
 *   2. where the bare word already names something else in the world — ocean, heroes, marathon,
 *      queen, memorial, prophet — require the word that makes it an event: "World Oceans Day",
 *      "Heroes' Day", "Boston Marathon", "King's Birthday", "Memorial Day", "Prophet's Birthday".
 * The disambiguation belongs here rather than in a caller: "Pieces of a Man" is not a tech
 * conference no matter which adapter ingests it.
 *
 * Measured twice against `date-holidays`, offline, by classifying every name with the rules
 * before and after:
 *   - the corpus the `holidays` adapter really sees (it asks for `languages: ["en"]`,
 *     `types: ["public"]`) is 761 distinct names over 206 countries × 2026-2028. Nine move: seven
 *     stop being tech conferences and become remembrance holidays instead (six spellings of Armed
 *     Forces Day plus "Defence Forces Day", all caught by a bare `ces` and none of them matching
 *     anything at all until the remembrance rule grew an armed-forces branch), "Kings Day" gains
 *     the royal tag it always deserved, and "Anniversary of the Revolution of the King and the
 *     People" loses `royal`, which is the one true positive knowingly given up — it names no
 *     occasion word, and the occasion word that would catch it, `anniversary`, is exactly what a
 *     tour title carries. Its category is unchanged; the adapter's fallback is already `holidays`.
 *   - the whole name table in data/holidays.json (3,466 strings across every locale, most of which
 *     the adapter never asks for) moves 26, adding the fifteen "Natalicio de <national hero>"
 *     names a bare `natal` filed as Christmas, "Frances Xavier Cabrini Day" from the conference
 *     rule, "Día no laborable con fines turísticos" from labor, and one further gain
 *     ("Valentinstag").
 *
 * WHAT IS NOT MEASURED. The comments below name real artists, records and venues to say what each
 * token collides with — "Frank Ocean", "Meteora", "Olympiastadion", "Marathon Music Works". Those
 * attributions come from memory: there was no network here, so nothing says the band is spelled
 * that way, or is a band at all. What IS checked is the only thing the rule depends on — that the
 * string does or does not match the regex, run before and after. Read a name as an illustration of
 * a shape, not as a fact about music.
 */
export const TAG_RULES: TagRule[] = [
  // \b on noël/boże/natal: without it "Noelle", "Bozeman" and the fifteen
  // "Natalicio de <national hero>" names in date-holidays' data came back tagged christmas — as
  // would "Natalie", "prenatal" and any other word ending in -natal. The inflections are spelled
  // out because they are the forms the data actually ships: Polish Christmas appears there only in
  // the genitive ("Wigilia Bożego Narodzenia" — bare "Boże" never occurs) and Italian Christmas
  // only as "Natale di Gesù", so anchoring on "boże"/"natal" alone silently dropped all five.
  [/christmas|navidad|weihnachten|\bno[eë]l\b|\bbo[zż]e(?:go)?\b|\bnatal[ei]?\b|xmas/i, "holidays", ["christmas", "religious"]],
  [/boxing day/i, "holidays", ["christmas"]],
  // The \b on the Romance forms is a substring guard, not a style choice: "ano novo" sits inside
  // "piano novo", "nouvel an" inside "nouvel angle".
  [/\bnew years?\b|\ba[nñ]o nuevo\b|\bnouvel an\b|neujahr|\bano novo\b|hogmanay/i, "holidays", ["new-year"]],
  // `easter` unanchored is "Eastern": every Eastern Conference final, Eastern Market and Middle
  // Eastern anything was a Christian holiday. `pascua`/`pasqua` were the surnames Pascual and
  // Pasquale. Italian "Pasquetta" never matched `pasqua` and still doesn't — that gap is old.
  [/\beaster\b|\bpascuas?\b|\bostern\b|\bp[aá]scoa\b|\bp[âa]ques\b|\bpasqua\b/i, "holidays", ["easter", "religious"]],
  [
    // `whit` was unanchored and matched any word containing it — Robert Whittaker and Dana White
    // are UFC fixtures, so a fight card came back tagged religious and categorised as a holiday.
    // The feast is Whitsun / Whit Sunday / Whit Monday and nothing else.
    //
    // ascension / assumption / epiphany are the same class of bug one level up: they are ordinary
    // English words and album, tour and TV titles ("The Ascension", "Epiphany Tour", "The
    // Immaculate Collection"). They are matched only with the feast's own qualifier, or as the
    // entire title — which is how the holiday sources spell them ("Epiphany", "Orthodox
    // Epiphany"). A record named exactly "Epiphany" or "Ascension" is still indistinguishable
    // from the feast on the title alone, and still lands here. The trailing parenthetical is not
    // decoration: date-holidays appends "(substitute day)" / "(substitutes)" to a name at runtime,
    // so "Assumption (substitute day)" reaches classify() and an unforgiving `$` loses it. Italian
    // "Ascensione" is spelled out for the same reason as the Christmas inflections — it is a name
    // in the data, and the anchored English spelling does not cover it.
    /good friday|holy (thursday|saturday)|ascension day|ascension thursday|feast of the ascension|de l'ascension|dell'ascensione|pentecost|whitsun\w*|whit (sunday|monday)|maundy|corpus christi|assumption day|feast of the assumption|assumption of (?:mary|our lady|the (?:blessed )?virgin)|immaculate conception|epiphany day|epiphany eve|epiphany (?:sunday|monday)|feast of the epiphany|epiphany of the lord|^(?:orthodox |catholic |coptic |holy )?(?:epiphany|ascensione?|assumption)(?: \((?:substitute[^)]*|observed)\))?$|three kings|all saints['’]?\s*(?:day|eve)|feast of all saints|all souls['’]?\s*day/i,
    "holidays",
    ["religious", "christian"],
  ],
  // prophet's (with the apostrophe) or the name: bare `prophet` made Prophets of Rage an Islamic
  // holiday. \beid\b: the seed's bare "eid" also matched "Perseid".
  [/ramadan|\beid\b|islamic|mawlid|muharram|prophet['’]s\b|prophet muhammad|muhammad prophet/i, "holidays", ["religious", "islamic"]],
  [/hanukkah|passover|yom kippur|rosh hash|purim|sukkot|shavuot/i, "holidays", ["religious", "jewish"]],
  // \bholi\b: a bare "holi" also matched the substring in "Holiday" (IE "June Holiday", UK bank
  // holidays). `buddha` needs the occasion for the same reason: on its own it titles as many
  // records and bars as it does birthdays.
  [
    /diwali|\bholi\b|dussehra|navaratri|vesak|vesakha|buddha['’]s\b|of (?:the )?buddha\b|buddha (?:purnima|jayanti|day)/i,
    "holidays",
    ["religious"],
  ],
  // `liberation` and `constitution` alone are a Christina Aguilera album and a DC concert hall
  // (DAR Constitution Hall); both now need the day. All eleven Liberation and seven Constitution
  // names in date-holidays' data/holidays.json still match — counted, not assumed.
  [
    /independence|national day|republic day|liberation day|day of liberation|liberation (?:from|of)\b|revolution day|constitution(?:al)? day|day of the constitution|unification|foundation day|statehood/i,
    "holidays",
    ["national"],
  ],
  // `labou?r` was a substring: Collaboration, Laboratory and Elaborate were all Labour Day. The
  // (?:er)?s? keeps "Arrival of Indentured Labourers", which the bare token used to catch.
  [/\blabou?r(?:er)?s?\b|\bworkers['’]?\b|\bmay day\b/i, "holidays", ["labor"]],
  [/thanksgiving/i, "holidays", ["thanksgiving"]],
  [/halloween|d[ií]a de (los )?muertos|day of the dead/i, "culture", ["halloween"]],
  // memorial/veterans/heroes without the occasion are venues and records: Memorial Stadium,
  // Veterans Memorial Coliseum, Bowie's "Heroes". Both spellings of the apostrophe appear in the
  // holiday data ("Heroes' Day" and "Heroes’ Day"), as does the bare "Heroes Day". The "heroes
  // and" branch exists for one name, "Heroes’ and Forefathers Day", and has to keep looking for
  // the day: without that lookahead it makes the Beach Boys' "Heroes and Villains" a remembrance
  // holiday, which is the bug this rule is here to stop.
  //
  // The armed-forces branch is here because anchoring `ces` in the tech rule below left the six
  // "forces" names in date-holidays' data (counted: Armed Forces Day ×3 spellings, Azerbaijan
  // Armed Forces Day, Defence Forces Day, Victory of Armed Forces Day) matching nothing at all —
  // a wrong tag traded for none. They belong here. The `day` lookahead keeps the branch off a
  // bare "Armed Forces"; `forces armées` is spelled separately because the one French name,
  // "Journée de la Révolution et des Forces Armées", says its occasion in French.
  [
    /memorial day|day of memorial|veterans['’]?\s+day|of the veterans\b|armistice|remembrance|anzac|victory day|heroes['’]?\s+day\b|heroes['’]?\s+and\b(?=[^]*\bday\b)|national heroes\b|\b(?:armed|defen[cs]e)\s+forces\b(?=[^]*\bday\b)|forces arm[ée]es/i,
    "holidays",
    ["remembrance"],
  ],
  // A royal holiday is a royal noun *and* the occasion, in either order — "King's Birthday",
  // "Birthday of Queen Sonja", "Hari Keputeraan Sultan Kedah". The bare nouns were catching the
  // band Queen, King Gizzard, Royal Blood, the Royal Albert Hall, King's Theatre Glasgow and
  // WWE's Royal Rumble. `day` is a broad second half — a royal noun beside a numbered tour date
  // ("Queen Live at Wembley, Day 2") still matches — but every narrower occasion list dropped real
  // holidays. `birthday of` stays a rule of its own: it predates this and still carries
  // the birth-anniversary holidays that name no title ("Birthday of Simón Bolívar").
  [
    /\bbirthday of\b|^(?=.*\b(?:kings?|queens?|sultans?|emperors?|royal)\b)(?=.*\b(?:birthdays?|day|feast|coronation|jubilee|funeral|enthronement|installation|keputeraan|pertabalan|hari hol|mourning|accession|ceremony)\b)/i,
    "holidays",
    ["royal"],
  ],
  // The holiday is Valentine's / Saint Valentine / Valentinstag. Bare "Valentine" is My Bloody
  // Valentine.
  [/valentine['’]?s\b|saint valentine|valentinstag|san valent[ií]n/i, "culture", ["romance"]],
  [/women'?s day/i, "culture", ["social"]],
  // "ocean" alone is Frank Ocean, Ocean Avenue and Oceans Ate Alaska; the observance is World
  // Oceans Day / Ocean Day / Day of the Ocean, so the day has to be in the title.
  [/\bearth day\b|\b(?:oceans?|environment(?:al)?)\b(?=[^]*\bday\b)|day of the (?:ocean|environment)/i, "nature", ["earth"]],
  // Sports before the family rule: "Youth Olympics" is a sporting event, not a family day. Tokens
  // are deliberately narrow ("Final Fantasy", "Justice League", "Video Games Day" must not match).
  // `olympi` used to swallow every Olympia-named venue there is — Olympiastadion, Olympiahalle,
  // L'Olympia, the Olympia Theatre — so the Games are matched as Olympics/Olympiad/Olympic Games.
  // `marathon` needs the race's qualifier in front of it ("Boston Marathon", "Marathon de Paris"),
  // which "Marathon Music Works" and "The Marathon Continues" lack. Not airtight: a possessive in
  // front of the venue ("Nashville's Marathon Music Works") still reads as a qualifier.
  // `conference (semi)?finals` is here to catch what anchoring `easter` set loose: those rounds
  // used to be filed as a Christian feast, and with `easter` fixed they would have fallen past
  // every sports token into the tech rule's `conference` instead of landing in sport.
  [
    /\b(?:olympics|paralympics)\b|\b(?:olympic|paralympic)\s+(?:winter\s+|summer\s+)?games\b|\bolympiads?\b|world cup|super bowl|grand slam|grand prix|championship|tournament|\b(?!the\b)\w+ marathon\b|\bmarathon (?:de|des|di|du|of)\b|wimbledon|tour de france|asian games|african games|commonwealth games|pan american games|university games|(?:champions|europa|conference|premier) league|\bconference (?:semi)?finals?\b|\b(?:cup|league) final\b|grand final|\b(?:australian|french|british|us|u\.s\.) open\b|\b(?:stanley|ryder|davis|fed|america's) cup\b/i,
    "sports",
    ["sports"],
  ],
  // The observance is Children's Day / Youth Day / Family Day. The bare nouns were filing Sonic
  // Youth, Youth Lagoon, Children of Bodom and Sly & the Family Stone under family culture.
  [
    /children['’]?s? (?:day|rights)|day of (?:the )?child\b|youth['’]?s? day|youth and sports|\bfamily day\b|day of (?:the )?famil/i,
    "culture",
    ["family"],
  ],
  // \bmeteor\b, or Linkin Park's "Meteora" is a meteor shower.
  [/\beclipse\b|\bequinox\b|\bsolstice\b|\bmeteors?\b|\bcomet\b|transit of/i, "astronomy", ["sky"]],
  // \belection\b: unanchored it matched "Selection" — which titles compilations ("Natural
  // Selection", "Best Selection 2000") and, as "Selection Sunday", a sporting event.
  [/\belections?\b|inauguration|referendum/i, "politics", ["elections"]],
  // \bces\b is the trade show. As a bare substring it matched every plural in the language —
  // Voices, Faces, Pieces of a Man, Places, Traces, Forces — including seven of the names the
  // holidays adapter emits, six of them some country's Armed Forces Day.
  [/\bces\b|wwdc|google i\/o|re:invent|conference/i, "tech", ["conference"]],
];

export const FEATURED_NAMES =
  /christmas day|new year'?s (day|eve)|halloween|thanksgiving day|independence day|eid al-fitr|diwali|lunar new year|chinese new year/i;

const CATEGORY_SET = new Set<string>(CATEGORIES);

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

export function slugify(input: string): string {
  return String(input)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Short stable digest of a title, for slugs of titles that have no Latin letters. */
export function titleDigest(title: string): string {
  return createHash("sha256").update(String(title).normalize("NFKC").trim()).digest("hex").slice(0, 8);
}

/**
 * Slug base for a title: `slugify(title)`, or — when the title has no Latin letters at all
 * (Arabic, Thai, … holiday names) — `<fallbackPrefix>-<digest>`, deterministic per title so
 * re-ingestion updates the same row and different names on the same day never collide.
 */
export function slugBase(title: string, fallbackPrefix: string): string {
  const base = slugify(title);
  if (base) return base;
  const prefix = slugify(fallbackPrefix) || "event";
  return `${prefix}-${titleDigest(title)}`;
}

export function classify(name: string, fallback: Category = "holidays"): { category: Category; tags: string[] } {
  for (const [re, category, tags] of TAG_RULES) {
    if (re.test(name)) return { category, tags: [...tags] };
  }
  return { category: fallback, tags: [] };
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoDate(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function parseInstant(dateStr: string): number {
  if (typeof dateStr !== "string") return NaN;
  return Date.parse(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00Z`);
}

/** Exact instant `now + FAR_FUTURE_YEARS`; rows later than this are dropped unless tagged `far-future`. */
export function farFutureCutoffMs(now: Date = new Date()): number {
  const d = new Date(now.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + FAR_FUTURE_YEARS);
  return d.getTime();
}

export function isFarFuture(date: string, tags: readonly string[], now: Date = new Date()): boolean {
  const t = parseInstant(date);
  if (Number.isNaN(t)) return false;
  return t > farFutureCutoffMs(now) && !tags.includes("far-future");
}

/**
 * Exclusive end (ms) of the period a date covers at a given precision: year precision
 * `2026-01-01` covers all of 2026, month precision `2026-09-01` all of September.
 */
export function precisionEnd(t: number, precision: IngestPrecision): number {
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

/** Last calendar day (`YYYY-MM-DD`) covered by `date` at `precision`. */
export function periodEnd(date: string, precision: IngestPrecision): string {
  const t = parseInstant(date);
  if (precision === "instant" || precision === "day") return date.slice(0, 10);
  const end = new Date(precisionEnd(t, precision) - 86_400_000);
  return isoDate(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate());
}

/** Keep anything from yesterday onward, precision-aware (a year placeholder survives until the year ends). */
export function isFutureOrFar(date: string, precision: IngestPrecision = "day", now: Date = new Date()): boolean {
  const t = parseInstant(date);
  if (Number.isNaN(t)) return false;
  return precisionEnd(t, precision) > now.getTime() - 2 * 86_400_000;
}

/** Wikidata `wikibase:timePrecision` → catalog precision (anything coarser than a year is rejected). */
export function precisionFromWikidata(prec: number): IngestPrecision | null {
  switch (prec) {
    case 11:
      return "day";
    case 10:
      return "month";
    case 9:
      return "year";
    case 8:
      return "decade";
    default:
      return null;
  }
}

const PRECISION_RANK: Record<IngestPrecision, number> = { instant: 0, day: 1, month: 2, quarter: 3, year: 4, decade: 5 };

export function isCoarse(precision: IngestPrecision): boolean {
  return PRECISION_RANK[precision] > PRECISION_RANK.day;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Strip tags, `[12]`/`[citation needed]` markers and entities; collapse whitespace; cap at TITLE_MAX. */
export function sanitizeTitle(raw: string): string {
  let s = String(raw ?? "");
  s = s.replace(/<ref[\s\S]*?<\/ref>/gi, " ").replace(/<ref[^>]*\/>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  s = s.replace(/\[[^\]]{0,40}\]/g, " "); // [1], [a], [citation needed]
  s = s.replace(/[\u200b-\u200d\ufeff]/g, "");
  s = s.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
  if (s.length > TITLE_MAX) s = s.slice(0, TITLE_MAX).replace(/\s+\S*$/, "").trim();
  return s;
}

export function rejectReserved(slug: string): boolean {
  return slug.startsWith("mine-") || slug.startsWith("share-");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function sortedObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => [k, obj[k]]),
  );
}

export type HashFields = Pick<
  IngestEvent,
  | "title"
  | "description"
  | "date"
  | "end_date"
  | "all_day"
  | "category"
  | "tags"
  | "regions"
  | "source"
  | "source_url"
  | "featured"
  | "popularity"
  | "status"
  | "date_precision"
  | "confidence"
  | "external_ids"
> &
  Partial<Pick<IngestEvent, "series_slug">>;

/**
 * sha256 over the content fields. Field order and JSON shape are identical to
 * scripts/push-catalog.mjs `contentHash` so a re-ingest of an unchanged row is
 * reported `unchanged` instead of `updated`; `series_slug` is appended only when set,
 * which keeps the hashes of series-less rows (holidays, wikidata, wikipedia) compatible.
 */
export function contentHash(row: HashFields): string {
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
    external_ids: sortedObject(row.external_ids ?? {}),
    ...(row.series_slug ? { series_slug: row.series_slug } : {}),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * A tag no longer than the schema allows. The trailing `-` a mid-word cut leaves is dropped, so
 * the tag stays a well-formed slug and two names that differ only past the cut still collapse.
 */
export function clampTag(tag: string): string {
  return tag.length <= TAG_MAX ? tag : tag.slice(0, TAG_MAX).replace(/-+$/, "");
}

export type BuildEventInput = {
  title: string;
  date: string;
  endDate?: string | null;
  category: Category;
  tags?: string[];
  regions?: string[];
  description?: string;
  source: IngestEvent["source"];
  sourceUrl?: string | null;
  /** Defaults to `<source>:<slug>`. */
  sourceKey?: string;
  /**
   * Prefix for the slug base when `slugify(title)` is empty (no Latin letters); defaults to the
   * source id. See `slugBase()`.
   */
  slugFallbackPrefix?: string;
  featured?: boolean;
  popularity?: number;
  allDay?: boolean;
  datePrecision?: IngestPrecision;
  status?: IngestStatus;
  confidence?: number;
  externalIds?: Record<string, unknown>;
  seriesSlug?: string | null;
  location?: Record<string, unknown> | null;
  timezone?: string | null;
  summary?: string | null;
  raw?: unknown;
};

const DEFAULT_CONFIDENCE: Partial<Record<IngestEvent["source"], number>> = {
  curated: 1,
  holidays: 1,
  wikipedia: 0.8,
};

/**
 * Build one normalised `IngestEvent` row (the `makeEvent` + `toRow` port). The slug is
 * `slugify(title)-YYYY-MM-DD` (`slugBase()` supplies a digest base for titles without Latin
 * letters); `content_hash` is computed last over the final values.
 */
export function buildEvent(input: BuildEventInput): IngestEvent {
  const title = sanitizeTitle(input.title);
  const isInstant = input.date.includes("T");
  const allDay = input.allDay !== false && !isInstant;
  const day = catalogDay(input.date, input.timezone);
  const date = allDay ? day : input.date;
  const slug = `${slugBase(title, input.slugFallbackPrefix ?? input.source)}-${day}`;
  const precision: IngestPrecision = isInstant ? "instant" : (input.datePrecision ?? "day");
  const status: IngestStatus = input.status ?? (isCoarse(precision) ? "tentative" : "scheduled");
  const rawEnd = input.endDate ? (allDay ? input.endDate.slice(0, 10) : input.endDate) : null;
  const endDate = rawEnd && rawEnd.slice(0, 10) >= day ? rawEnd : null;
  // Clamp before the Set: two names that truncate to the same tag are the same tag.
  const tags = [...new Set((input.tags ?? []).map((t) => clampTag(slugify(t))).filter(Boolean))].slice(0, TAGS_MAX);
  const regions = [...new Set((input.regions ?? []).filter(Boolean))];
  const confidence =
    input.confidence !== undefined
      ? clamp(Number(input.confidence) || 0, 0, 1)
      : input.source === "wikidata"
        ? isCoarse(precision)
          ? 0.6
          : 0.7
        : (DEFAULT_CONFIDENCE[input.source] ?? 0.5);
  const externalIds = sortedObject(input.externalIds ?? {});
  const row: IngestEvent = {
    slug,
    title,
    description: String(input.description ?? "").trim(),
    summary: input.summary ?? null,
    date,
    end_date: endDate,
    all_day: allDay,
    timezone: input.timezone ?? null,
    category: isCategory(input.category) ? input.category : "culture",
    tags,
    regions: regions.length ? regions : ["GLOBAL"],
    source: input.source,
    source_url: input.sourceUrl || null,
    source_key: input.sourceKey ?? `${input.source}:${slug}`,
    external_ids: externalIds,
    status,
    date_precision: precision,
    confidence,
    featured: Boolean(input.featured),
    popularity: clamp(Math.round(Number(input.popularity ?? 20)) || 0, 0, 100),
    series_slug: input.seriesSlug ?? null,
    location: input.location ?? null,
    jsonld_eligible: false,
    image_candidate_url: null,
    image_candidate_meta: null,
    content_hash: "",
    raw: input.raw ?? null,
  };
  row.content_hash = contentHash(row);
  return row;
}

/** Recompute the hash after in-place edits (tag/region merges). */
export function rehash(row: IngestEvent): IngestEvent {
  row.content_hash = contentHash(row);
  return row;
}
