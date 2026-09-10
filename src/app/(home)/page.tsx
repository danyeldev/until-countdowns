import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { CatalogExplorer } from "@/components/CatalogExplorer";
import { EventCard } from "@/components/EventCard";
import { EventTable } from "@/components/EventTable";
import { FeaturedHero } from "@/components/FeaturedHero";
import { JsonLd } from "@/components/JsonLd";
import {
  categoryCounts,
  countryCounts,
  eventsWithinDays,
  featuredUpcoming,
  logSearch,
  searchEvents,
  topSeries,
} from "@/lib/catalog";
import { organization, webSite } from "@/lib/jsonld";
import { CATEGORY_LABELS } from "@/lib/labels";
import { COUNTRY_NAMES } from "@/lib/regions";
import { buildMetadata, formatShortDate, HOME_TITLE, monthLabel, nextMonth, pad2, SITE_DESCRIPTION, todayUtc, yearMonthOf } from "@/lib/seo";
import { CATEGORY_GROUPS } from "@/lib/taxonomy";
import { humanDays } from "@/lib/time";
import { CATEGORIES, type Category } from "@/lib/types";

const SORTS = ["soonest", "popular", "latest"] as const;
type Sort = (typeof SORTS)[number];

const TOP_COUNTRIES = 24;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

type HomeQuery = { q?: string; category?: Category; sort: Sort; page: number; hub: boolean; filtered: boolean };

function parseQuery(sp: Record<string, string | string[] | undefined>): HomeQuery {
  const q = first(sp.q)?.trim().slice(0, 80) || undefined;
  const categoryRaw = first(sp.category);
  const category = CATEGORIES.includes(categoryRaw as Category) ? (categoryRaw as Category) : undefined;
  const sortRaw = first(sp.sort);
  const sort: Sort = SORTS.includes(sortRaw as Sort) ? (sortRaw as Sort) : "soonest";
  const page = Math.min(1000, Math.max(1, Math.floor(Number(first(sp.page))) || 1));
  return {
    q,
    category,
    sort,
    page,
    hub: !q && !category && page === 1,
    // Any query variant (`?q=`, `?sort=`, `?page=2`, `?category=`) is a filtered view of `/`.
    filtered: Boolean(q || categoryRaw || sortRaw || page > 1),
  };
}

/** The home page already reads `searchParams`, so metadata reading them makes nothing more dynamic. */
export async function generateMetadata({ searchParams }: PageProps<"/">): Promise<Metadata> {
  const { filtered } = parseQuery(await searchParams);
  const metadata = buildMetadata({
    title: HOME_TITLE,
    description: SITE_DESCRIPTION,
    canonical: "/",
    ogPath: "/og/default",
    noindex: filtered,
  });
  // The layout template appends "· Until"; the home title already names the site.
  metadata.title = { absolute: HOME_TITLE };
  return metadata;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const { q, category, sort, page, hub } = parseQuery(await searchParams);

  const [highlights, result, counts, next7, popular, countries] = await Promise.all([
    featuredUpcoming(5),
    searchEvents({ q, category, sort, page, pageSize: 24 }),
    categoryCounts(),
    hub ? eventsWithinDays({ minDays: 0, maxDays: 7, sort: "popular", limit: 10 }) : [],
    hub ? topSeries(12) : [],
    hub ? countryCounts() : ({} as Record<string, number>),
  ]);
  const featured = highlights[0];
  const more = highlights.slice(1, 5);
  // Popularity picks the ten rows; the table promises a day-by-day view, so render them in date order.
  next7.sort((a, b) => a.date.localeCompare(b.date) || b.popularity - a.popularity);

  // Past the end of the result window (a stale deep link, or the catalog shrank): the RPC returns
  // no rows and therefore no total, which would strip the pagination UI. Send the visitor to page 1
  // of the same query instead of a dead end.
  if (result.items.length === 0 && page > 1) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (category) p.set("category", category);
    if (sort !== "soonest") p.set("sort", sort);
    const qs = p.toString();
    redirect(qs ? `/?${qs}` : "/");
  }

  if (q) {
    const total = result.total;
    after(() => logSearch(q, total));
  }

  const today = todayUtc();
  const thisMonth = yearMonthOf(today);
  const next = nextMonth(thisMonth.year, thisMonth.month);
  const topCountries = Object.entries(countries)
    .filter(([code, n]) => n > 0 && COUNTRY_NAMES[code])
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_COUNTRIES);

  return (
    <div>
      {hub && featured ? (
        <>
          <FeaturedHero event={featured} />
          {more.length > 0 && (
            <section className="mt-10">
              <h2 className="font-serif text-2xl text-paper">Also on the horizon</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {more.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}

      {hub ? (
        <>
          {next7.length > 0 ? (
            <section className="mt-14">
              <div className="flex items-end justify-between gap-4">
                <h2 className="font-serif text-2xl text-paper">Next 7 days</h2>
                <Link href={`/calendar/${thisMonth.year}/${pad2(thisMonth.month)}`} className="text-sm text-paper-dim hover:text-paper">
                  Whole month →
                </Link>
              </div>
              <EventTable events={next7} />
            </section>
          ) : null}

          <section className="mt-14">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-serif text-2xl text-paper">Browse by category</h2>
              <Link href="/category" className="text-sm text-paper-dim hover:text-paper">
                All categories →
              </Link>
            </div>
            <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {CATEGORY_GROUPS.map((group) => (
                <div key={group.id} className="ticket rounded-2xl p-5">
                  <h3 className="font-serif text-lg text-paper">{group.label}</h3>
                  <p className="mt-1 text-xs text-muted">{group.tagline}</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {group.categories.map((c) =>
                      (counts[c] ?? 0) > 0 ? (
                        <li key={c}>
                          <Link href={`/category/${c}`} className="inline-flex items-baseline gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-paper-dim hover:text-paper">
                            {CATEGORY_LABELS[c]}
                            <span className="tabular font-mono text-[10px] text-muted">{(counts[c] ?? 0).toLocaleString("en-US")}</span>
                          </Link>
                        </li>
                      ) : (
                        // Empty categories are noindex and out of the sitemap; show them dimmed, unlinked.
                        <li key={c} className="inline-flex items-baseline rounded-full border border-line/40 px-2.5 py-1 text-xs text-muted/70" title="Nothing here yet">
                          {CATEGORY_LABELS[c]}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {popular.length > 0 ? (
            <section className="mt-14">
              <div className="flex items-end justify-between gap-4">
                <h2 className="font-serif text-2xl text-paper">Popular countdowns</h2>
                <Link href="/days-until" className="text-sm text-paper-dim hover:text-paper">
                  Every recurring date →
                </Link>
              </div>
              <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {popular.map((s) => (
                  <li key={s.slug} className="ticket flex items-baseline justify-between gap-3 rounded-xl px-4 py-3">
                    <Link href={`/days-until/${s.slug}`} className="text-paper hover:text-amber">
                      {s.title}
                    </Link>
                    <span className="tabular whitespace-nowrap font-mono text-xs text-muted">
                      {s.nextDate ? (typeof s.daysUntil === "number" ? humanDays(s.daysUntil) : formatShortDate(s.nextDate)) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-14 grid gap-10 lg:grid-cols-[2fr_1fr]">
            <div>
              <div className="flex items-end justify-between gap-4">
                <h2 className="font-serif text-2xl text-paper">By country</h2>
                <Link href="/country" className="text-sm text-paper-dim hover:text-paper">
                  All countries →
                </Link>
              </div>
              {topCountries.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Country data is being filled.</p>
              ) : (
                <ul className="mt-5 flex flex-wrap gap-2">
                  {topCountries.map(([code, n]) => (
                    <li key={code}>
                      <Link href={`/country/${code.toLowerCase()}`} className="inline-flex items-baseline gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-paper-dim hover:text-paper">
                        {COUNTRY_NAMES[code]}
                        <span className="tabular font-mono text-[10px] text-muted">{n.toLocaleString("en-US")}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h2 className="font-serif text-2xl text-paper">By month</h2>
              <ul className="mt-5 space-y-2 text-sm">
                <li>
                  <Link href={`/calendar/${thisMonth.year}/${pad2(thisMonth.month)}`} className="text-paper-dim hover:text-paper">
                    This month — {monthLabel(thisMonth.year, thisMonth.month)}
                  </Link>
                </li>
                <li>
                  <Link href={`/calendar/${next.year}/${pad2(next.month)}`} className="text-paper-dim hover:text-paper">
                    Next month — {monthLabel(next.year, next.month)}
                  </Link>
                </li>
              </ul>
            </div>
          </section>
        </>
      ) : null}

      <form action="/" className="mt-8 sm:hidden">
        <label className="sr-only" htmlFor="mobile-search">
          Search
        </label>
        <input
          id="mobile-search"
          name="q"
          defaultValue={q}
          placeholder="Search the catalog…"
          className="w-full rounded-full border border-line bg-ink-2 px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-amber/60"
        />
      </form>

      <CatalogExplorer
        events={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        q={q}
        category={category}
        sort={sort}
        counts={counts}
      />

      <JsonLd data={[webSite(), organization()]} />
    </div>
  );
}
