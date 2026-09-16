/**
 * Editorial catalog lists on `/collections`. They are not rows in `event_collections` —
 * they keep the public directory from looking empty before people publish their own.
 */
import { eventsWithinDays, searchEvents } from "./catalog";
import {
  FEATURED_COLLECTIONS,
  parseFeaturedCollectionSlug,
  type FeaturedCollection,
  type FeaturedCollectionSlug,
} from "./featured-collections-meta";
import { imageUrl, isShareAlike } from "./images";
import type { CountdownEvent } from "./types";

export {
  FEATURED_COLLECTION_SLUGS,
  FEATURED_COLLECTIONS,
  featuredCollectionHref,
  parseFeaturedCollectionSlug,
  type FeaturedCollection,
  type FeaturedCollectionSlug,
} from "./featured-collections-meta";

const MONTH_DAY_SPLIT =
  /,\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\b/;

const HORRORISH =
  /horror|halloween|scream|slasher|resident evil|friday the 13|haunted|ghost|vampire|witch|zombie|crystal lake|\bcarrie\b|helluva|yellowjacket|lizzie borden|city of blood|mis muertos|balaraw/i;

const DRINKISH =
  /beer|oktober|oktoberfest|brew|wine|cider|chug|cheers|carnival|mardi gras|st\.?\s*patrick|pub\b|rum\b|tequila|whisky|whiskey/i;

const NOBODY_ASKED =
  /pirate|batman|stupid|beer|ask a|talk like|one web|michaelmas|towel|star wars|pi day|leap |palindrome|friday the 13|hug |kiss |joke|prank|lazy|emoji|gamer|comic|superhero|witch|halloween|music day/i;

const SOMEBODY_ASKED = /citizenship|sovereignty|martyr|community holiday|unity day|glynd/i;

function uniqueBySlug(events: CountdownEvent[]): CountdownEvent[] {
  const seen = new Set<string>();
  const out: CountdownEvent[] = [];
  for (const event of events) {
    if (seen.has(event.slug)) continue;
    seen.add(event.slug);
    out.push(event);
  }
  return out;
}

function daysUntil(event: CountdownEvent): number | null {
  return typeof event.daysUntil === "number" ? event.daysUntil : null;
}

function upcomingWithin(events: CountdownEvent[], maxDays: number): CountdownEvent[] {
  return events.filter((event) => {
    const days = daysUntil(event);
    return days != null && days >= 0 && days <= maxDays;
  });
}

function soonestFirst(events: CountdownEvent[]): CountdownEvent[] {
  return [...events].sort((a, b) => {
    const left = daysUntil(a) ?? 9_999;
    const right = daysUntil(b) ?? 9_999;
    if (left !== right) return left - right;
    return b.popularity - a.popularity || a.title.localeCompare(b.title);
  });
}

function takeWindow(
  events: CountdownEvent[],
  tightDays: number,
  looseDays: number,
  minCount: number,
): CountdownEvent[] {
  const tight = soonestFirst(upcomingWithin(events, tightDays));
  if (tight.length >= minCount) return tight;
  return soonestFirst(upcomingWithin(events, looseDays));
}

function looksHorror(event: CountdownEvent): boolean {
  if (event.tags.some((tag) => /horror|halloween|friday-13th/.test(tag))) return true;
  return HORRORISH.test(event.title);
}

function drinkScore(event: CountdownEvent): number {
  if (event.tags.includes("beer") || DRINKISH.test(event.title) || event.tags.some((tag) => DRINKISH.test(tag))) {
    return 1;
  }
  return 0;
}

function excuseScore(event: CountdownEvent): number {
  if (NOBODY_ASKED.test(event.title)) return 2;
  if (SOMEBODY_ASKED.test(event.title)) return 0;
  return 1;
}

async function loadScreamThisMonth(): Promise<CountdownEvent[]> {
  const [tagged, halloween, friday, films] = await Promise.all([
    searchEvents({ tag: "horror", sort: "soonest", pageSize: 24 }),
    searchEvents({ q: "halloween", sort: "soonest", pageSize: 12 }),
    searchEvents({ q: "friday the 13th", pageSize: 4 }),
    eventsWithinDays({ category: "film", maxDays: 45, sort: "soonest", limit: 40 }),
  ]);
  const merged = uniqueBySlug([
    ...tagged.items,
    ...halloween.items,
    ...friday.items,
    ...films.filter(looksHorror),
  ]);
  const pins = merged.filter(
    (event) => /^halloween$/i.test(event.title) || /friday the 13th/i.test(event.title),
  );
  const rest = takeWindow(
    merged.filter((event) => !pins.includes(event)),
    45,
    75,
    6,
  );
  const room = Math.max(0, 12 - pins.length);
  return soonestFirst(uniqueBySlug([...rest.slice(0, room), ...pins]));
}

async function loadGetDrunkThisWeek(): Promise<CountdownEvent[]> {
  const festivals = await eventsWithinDays({
    category: "festivals",
    maxDays: 16,
    sort: "soonest",
    limit: 40,
  });
  const cleaned = uniqueBySlug(festivals.filter((event) => !MONTH_DAY_SPLIT.test(event.title)));
  const pool = takeWindow(cleaned, 8, 16, 5);
  return [...pool]
    .sort((a, b) => {
      const drink = drinkScore(b) - drinkScore(a);
      if (drink !== 0) return drink;
      return (daysUntil(a) ?? 9_999) - (daysUntil(b) ?? 9_999);
    })
    .slice(0, 12);
}

async function loadMoviesThisWeek(): Promise<CountdownEvent[]> {
  const week = await eventsWithinDays({
    category: "film",
    maxDays: 7,
    sort: "soonest",
    limit: 40,
  });
  const releases = week
    .filter((event) => event.tags.includes("release"))
    .sort((a, b) => b.popularity - a.popularity || (daysUntil(a) ?? 9_999) - (daysUntil(b) ?? 9_999));
  const rest = week
    .filter((event) => !event.tags.includes("release"))
    .sort((a, b) => b.popularity - a.popularity || (daysUntil(a) ?? 9_999) - (daysUntil(b) ?? 9_999));
  const picked = uniqueBySlug([...releases, ...rest]);
  if (picked.length >= 6) return picked.slice(0, 12);
  const wider = await eventsWithinDays({
    category: "film",
    maxDays: 14,
    sort: "soonest",
    limit: 24,
  });
  return uniqueBySlug([...picked, ...wider.filter((event) => event.tags.includes("release"))]).slice(
    0,
    12,
  );
}

async function loadNewSeasons(): Promise<CountdownEvent[]> {
  const week = await eventsWithinDays({
    category: "tv",
    maxDays: 10,
    sort: "soonest",
    limit: 40,
  });
  const premieres = week.filter((event) => event.tags.includes("premiere"));
  const picked = uniqueBySlug([...premieres, ...week]);
  if (picked.length >= 6) return picked.slice(0, 12);
  const wider = await eventsWithinDays({
    category: "tv",
    maxDays: 21,
    sort: "soonest",
    limit: 24,
  });
  return uniqueBySlug([...picked, ...wider.filter((event) => event.tags.includes("premiere"))]).slice(
    0,
    12,
  );
}

async function loadWeekendGames(): Promise<CountdownEvent[]> {
  const soon = await eventsWithinDays({
    category: "games",
    maxDays: 16,
    sort: "soonest",
    limit: 16,
  });
  if (soon.length >= 6) return soon.slice(0, 12);
  return eventsWithinDays({ category: "games", maxDays: 30, sort: "soonest", limit: 12 });
}

async function loadHolidaysNobodyAskedFor(): Promise<CountdownEvent[]> {
  const [fun, pirate, friday] = await Promise.all([
    eventsWithinDays({ category: "fun", maxDays: 30, sort: "soonest", limit: 24 }),
    searchEvents({ q: "talk like a pirate", pageSize: 4 }),
    searchEvents({ q: "friday the 13th", pageSize: 4 }),
  ]);
  const merged = uniqueBySlug([
    ...fun,
    ...upcomingWithin(pirate.items, 30),
    ...upcomingWithin(friday.items, 70),
  ]);
  const punchlines = merged.filter((event) => excuseScore(event) > 0);
  const pool = punchlines.length >= 6 ? punchlines : merged;
  return [...pool]
    .sort((a, b) => {
      const vibe = excuseScore(b) - excuseScore(a);
      if (vibe !== 0) return vibe;
      return (daysUntil(a) ?? 9_999) - (daysUntil(b) ?? 9_999);
    })
    .slice(0, 12);
}

async function loadEvents(slug: FeaturedCollectionSlug): Promise<CountdownEvent[]> {
  switch (slug) {
    case "scream-this-month":
      return loadScreamThisMonth();
    case "get-drunk-this-week":
      return loadGetDrunkThisWeek();
    case "movies-this-week":
      return loadMoviesThisWeek();
    case "new-seasons-same-couch":
      return loadNewSeasons();
    case "weekend-ruining-games":
      return loadWeekendGames();
    case "holidays-nobody-asked-for":
      return loadHolidaysNobodyAskedFor();
  }
}

export async function loadFeaturedCollection(slug: string): Promise<{
  meta: FeaturedCollection;
  events: CountdownEvent[];
} | null> {
  const parsed = parseFeaturedCollectionSlug(slug);
  if (!parsed) return null;
  const meta = FEATURED_COLLECTIONS.find((item) => item.slug === parsed);
  if (!meta) return null;
  return { meta, events: await loadEvents(parsed) };
}

function coverUrlFromEvents(events: CountdownEvent[]): string | null {
  const image =
    events.find((event) => event.image && !isShareAlike(event.image.license))?.image ??
    events.find((event) => event.image)?.image;
  return image ? imageUrl(image, "card") : null;
}

export async function listFeaturedCollections(): Promise<
  { meta: FeaturedCollection; itemCount: number; coverUrl: string | null }[]
> {
  return Promise.all(
    FEATURED_COLLECTIONS.map(async (meta) => {
      const events = await loadEvents(meta.slug);
      return { meta, itemCount: events.length, coverUrl: coverUrlFromEvents(events) };
    }),
  );
}
