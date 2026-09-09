import catalog from "@/data/events.json";
import countries from "@/data/countries.json";
import type { CatalogFile, Category, CountdownEvent, SearchParams } from "./types";
import { eventInstant } from "./time";

const data = catalog as CatalogFile;
const countryNames = countries as Record<string, string>;

export const COUNTRY_NAMES = countryNames;

export function allEvents(): CountdownEvent[] {
  return data.events as CountdownEvent[];
}

export function catalogMeta() {
  return {
    generatedAt: data.generatedAt,
    count: data.count,
    stats: data.stats,
    sources: data.sources,
  };
}

export function getEvent(slug: string): CountdownEvent | undefined {
  return allEvents().find((e) => e.slug === slug);
}

export function regionLabel(code: string): string {
  if (code === "GLOBAL") return "Worldwide";
  return countryNames[code] || code;
}

export function regionSummary(regions: string[], limit = 3): string {
  if (regions.includes("GLOBAL") && regions.length === 1) return "Worldwide";
  if (regions.length > 12) return `${regions.length} countries`;
  const names = regions.filter((r) => r !== "GLOBAL").map(regionLabel);
  if (names.length <= limit) return names.join(" · ");
  return `${names.slice(0, limit).join(" · ")} +${names.length - limit}`;
}

function matchesQuery(event: CountdownEvent, q: string): number {
  const needle = q.trim().toLowerCase();
  if (!needle) return 1;
  const title = event.title.toLowerCase();
  if (title === needle) return 100;
  if (title.startsWith(needle)) return 80;
  if (title.includes(needle)) return 60;
  if (event.tags.some((t) => t.includes(needle))) return 40;
  if (event.description.toLowerCase().includes(needle)) return 25;
  if (event.regions.some((r) => r.toLowerCase() === needle || regionLabel(r).toLowerCase().includes(needle))) {
    return 20;
  }
  return 0;
}

export function searchEvents(params: SearchParams = {}): {
  items: CountdownEvent[];
  total: number;
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 24));
  const now = Date.now() - 12 * 3_600_000;
  let scored = allEvents()
    .map((event) => ({ event, score: matchesQuery(event, params.q ?? "") }))
    .filter((row) => row.score > 0);

  if (params.category && params.category !== "all") {
    scored = scored.filter((row) => row.event.category === params.category);
  }
  if (params.tag) {
    scored = scored.filter((row) => row.event.tags.includes(params.tag!));
  }
  if (params.region) {
    const region = params.region.toUpperCase();
    scored = scored.filter(
      (row) => row.event.regions.includes(region) || row.event.regions.includes("GLOBAL"),
    );
  }
  if (params.featured) {
    scored = scored.filter((row) => row.event.featured);
  }

  const sort = params.sort ?? "soonest";
  scored.sort((a, b) => {
    if (sort === "popular") return b.event.popularity - a.event.popularity || a.event.date.localeCompare(b.event.date);
    if (sort === "latest") return b.event.date.localeCompare(a.event.date);
    const aPast = eventInstant(a.event.date, a.event.allDay).getTime() < now;
    const bPast = eventInstant(b.event.date, b.event.allDay).getTime() < now;
    if (aPast !== bPast) return aPast ? 1 : -1;
    if ((params.q ?? "").trim()) return b.score - a.score || a.event.date.localeCompare(b.event.date);
    return a.event.date.localeCompare(b.event.date);
  });

  const total = scored.length;
  const start = (page - 1) * pageSize;
  return {
    items: scored.slice(start, start + pageSize).map((r) => r.event),
    total,
    page,
    pageSize,
  };
}

export function featuredUpcoming(limit = 1): CountdownEvent[] {
  const now = Date.now() - 6 * 3_600_000;
  const future = allEvents().filter(
    (e) => e.featured && eventInstant(e.date, e.allDay).getTime() > now,
  );
  const curated = future
    .filter((e) => e.source === "curated" && e.category !== "history")
    .sort((a, b) => a.date.localeCompare(b.date) || b.popularity - a.popularity);
  const pool = curated.length ? curated : future.sort((a, b) => a.date.localeCompare(b.date));
  return pool.slice(0, limit);
}

export function soonestUpcoming(limit = 8): CountdownEvent[] {
  const now = Date.now() - 6 * 3_600_000;
  return allEvents()
    .filter((e) => eventInstant(e.date, e.allDay).getTime() > now)
    .sort((a, b) => a.date.localeCompare(b.date) || b.popularity - a.popularity)
    .slice(0, limit);
}

export function relatedEvents(event: CountdownEvent, limit = 6): CountdownEvent[] {
  const now = Date.now();
  return allEvents()
    .filter((e) => e.id !== event.id && e.date >= event.date.slice(0, 10))
    .map((e) => {
      let score = 0;
      if (e.category === event.category) score += 5;
      score += e.tags.filter((t) => event.tags.includes(t)).length * 3;
      if (e.featured) score += 2;
      score += e.popularity / 50;
      return { e, score };
    })
    .filter((r) => r.score > 0 && eventInstant(r.e.date, r.e.allDay).getTime() > now)
    .sort((a, b) => b.score - a.score || a.e.date.localeCompare(b.e.date))
    .slice(0, limit)
    .map((r) => r.e);
}

export function categoryCounts(): Record<Category, number> {
  const counts = {} as Record<Category, number>;
  for (const e of allEvents()) {
    counts[e.category] = (counts[e.category] || 0) + 1;
  }
  return counts;
}

export function popularTags(limit = 18): { tag: string; count: number }[] {
  const map = new Map<string, number>();
  for (const e of allEvents()) {
    for (const tag of e.tags) {
      if (tag === "wikipedia" || tag === "wikidata") continue;
      map.set(tag, (map.get(tag) || 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
