import type { MetadataRoute } from "next";
import {
  categoryCounts,
  countryCounts,
  indexableEvents,
  sitemapSeries,
  sitemapShardIds,
  tagsWithAtLeast,
} from "@/lib/catalog";
import { COUNTRY_NAMES } from "@/lib/regions";
import { absoluteUrl, CALENDAR_MAX_YEAR, nextMonth, pad2, todayUtc, yearMonthOf } from "@/lib/seo";
import { CATEGORIES } from "@/lib/types";

export const revalidate = 3600;

const MAX_URLS = 50_000;
const TAG_MIN_EVENTS = 8;
const CALENDAR_MONTHS = 24;

/**
 * Shards are served at `/sitemap/<id>.xml`; Next emits no index, so `/sitemap-index.xml`
 * (route handler next door) lists them. Ids are stable so search engines keep their history.
 */
export async function generateSitemaps(): Promise<{ id: string }[]> {
  return (await sitemapShardIds()).map((id) => ({ id }));
}

function entry(path: string, lastModified?: string): MetadataRoute.Sitemap[number] {
  const item: MetadataRoute.Sitemap[number] = { url: absoluteUrl(path) };
  if (lastModified) item.lastModified = lastModified;
  return item;
}

async function hubs(): Promise<MetadataRoute.Sitemap> {
  const out: MetadataRoute.Sitemap = [entry("/"), entry("/days-until"), entry("/category"), entry("/country"), entry("/about"), entry("/attributions")];
  // Empty categories render `noindex` (thin pages); they join the sitemap once they have rows.
  const byCategory = await categoryCounts();
  for (const c of CATEGORIES) if ((byCategory[c] ?? 0) > 0) out.push(entry(`/category/${c}`));

  const counts = await countryCounts();
  const codes = Object.keys(counts)
    .filter((cc) => counts[cc] > 0 && COUNTRY_NAMES[cc])
    .sort();
  for (const cc of codes) out.push(entry(`/country/${cc.toLowerCase()}`));

  let { year, month } = yearMonthOf(todayUtc());
  for (let i = 0; i < CALENDAR_MONTHS && year <= CALENDAR_MAX_YEAR; i++) {
    out.push(entry(`/calendar/${year}/${pad2(month)}`));
    ({ year, month } = nextMonth(year, month));
  }

  for (const { tag } of await tagsWithAtLeast(TAG_MIN_EVENTS)) {
    if (/^[a-z0-9-]{1,60}$/.test(tag)) out.push(entry(`/tag/${tag}`));
  }
  return out.slice(0, MAX_URLS);
}

async function series(): Promise<MetadataRoute.Sitemap> {
  return (await sitemapSeries()).map((s) => entry(`/days-until/${s.slug}`, s.updatedAt)).slice(0, MAX_URLS);
}

async function events(id: string): Promise<MetadataRoute.Sitemap> {
  const m = /^events-(\d{4})(?:-h([12]))?$/.exec(id);
  if (!m) return [];
  const half = m[2] === "1" ? 1 : m[2] === "2" ? 2 : 0;
  const rows = await indexableEvents(Number(m[1]), half);
  return rows.map((e) => entry(`/event/${e.slug}`, e.updatedAt)).slice(0, MAX_URLS);
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;
  if (id === "hubs") return hubs();
  if (id === "series") return series();
  return events(id);
}
