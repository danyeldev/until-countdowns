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
import { searchQueryFor } from "@/lib/i18n/content";
import { regionLabel } from "@/lib/i18n/regions";
import { i18n, localePage } from "@/lib/i18n/server";
import { organization, webSite } from "@/lib/jsonld";
import { COUNTRY_NAMES } from "@/lib/regions";
import { buildMetadata, displayTitle, nextMonth, pad2, todayUtc, yearMonthOf } from "@/lib/seo";
import { CATEGORY_GROUPS } from "@/lib/taxonomy";
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
export async function generateMetadata({ searchParams }: PageProps<"/[locale]">): Promise<Metadata> {
  const L = await i18n();
  const { filtered } = parseQuery(await searchParams);
  const metadata = buildMetadata({
    locale: L.locale,
    title: L.m.seo.homeTitle,
    description: L.m.seo.siteDescription,
    canonical: "/",
    ogPath: "/og/default",
    noindex: filtered,
  });
  // The layout template appends "· Until"; the home title already names the site.
  metadata.title = { absolute: L.m.seo.homeTitle };
  return metadata;
}

export default async function Home({ searchParams }: PageProps<"/[locale]">) {
  const L = await localePage();
  const { q, category, sort, page, hub } = parseQuery(await searchParams);

  // The catalog is one English corpus, so a Spanish reader typing "navidad" would match nothing.
  // `searchQueryFor()` swaps a query that names a curated entity for its English title; anything
  // else goes through untouched. The box keeps showing what was typed.
  const needle = q ? searchQueryFor(L.locale, q) : undefined;

  const [highlights, result, counts, next7, popular, countries] = await Promise.all([
    featuredUpcoming(5),
    searchEvents({ q: needle, category, sort, page, pageSize: 24 }),
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
  // of the same query instead of a dead end — in this locale, so a Spanish search stays Spanish.
  if (result.items.length === 0 && page > 1) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (category) p.set("category", category);
    if (sort !== "soonest") p.set("sort", sort);
    const qs = p.toString();
    redirect(L.href(qs ? `/?${qs}` : "/"));
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
      {/* The sticky header carries the search from `sm` up, where that row has space for it. On a
          phone it does not, so the box lives here — at the top of the page, ahead of the hub,
          rather than below the whole of it where nobody would scroll to find it. */}
      <form action={L.href("/")} className="mb-8 sm:hidden">
        <label className="sr-only" htmlFor="mobile-search">
          {L.m.common.search.label}
        </label>
        <input
          id="mobile-search"
          name="q"
          type="search"
          defaultValue={q}
          enterKeyHint="search"
          autoComplete="off"
          placeholder={L.m.common.search.placeholder}
          className="w-full rounded-full border border-line bg-ink-2 px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-amber/60"
        />
      </form>

      {hub && featured ? (
        <>
          <FeaturedHero L={L} event={featured} />
          {more.length > 0 && (
            <section className="mt-10">
              <h2 className="font-serif text-2xl text-paper">{L.m.home.hub.alsoOnTheHorizon}</h2>
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
                <h2 className="font-serif text-2xl text-paper">{L.m.home.hub.next7Days}</h2>
                <Link href={L.href(`/calendar/${thisMonth.year}/${pad2(thisMonth.month)}`)} className="text-sm text-paper-dim hover:text-paper">
                  {L.m.home.hub.wholeMonth}
                </Link>
              </div>
              <EventTable events={next7} />
            </section>
          ) : null}

          <section className="mt-14">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-serif text-2xl text-paper">{L.m.home.hub.browseByCategory}</h2>
              <Link href={L.href("/category")} className="text-sm text-paper-dim hover:text-paper">
                {L.m.home.hub.allCategories}
              </Link>
            </div>
            <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {CATEGORY_GROUPS.map((group) => {
                // `taxonomy.ts` owns the ids and which categories sit in each; the words are the
                // catalogue's, so a group reads as "Celebrar" without the taxonomy knowing that.
                const words = L.m.categories.groups[group.id as keyof typeof L.m.categories.groups];
                return (
                  <div key={group.id} className="ticket rounded-2xl p-5">
                    <h3 className="font-serif text-lg text-paper">{words.label}</h3>
                    <p className="mt-1 text-xs text-muted">{words.tagline}</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {group.categories.map((c) =>
                        (counts[c] ?? 0) > 0 ? (
                          <li key={c}>
                            <Link href={L.href(`/category/${c}`)} className="inline-flex items-baseline gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-paper-dim hover:text-paper">
                              {L.m.categories.labels[c]}
                              <span className="tabular font-mono text-[10px] text-muted">{L.fmt.number(counts[c] ?? 0)}</span>
                            </Link>
                          </li>
                        ) : (
                          // Empty categories are noindex and out of the sitemap; show them dimmed, unlinked.
                          <li key={c} className="inline-flex items-baseline rounded-full border border-line/40 px-2.5 py-1 text-xs text-muted/70" title={L.m.common.labels.nothingHereYet}>
                            {L.m.categories.labels[c]}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {popular.length > 0 ? (
            <section className="mt-14">
              <div className="flex items-end justify-between gap-4">
                <h2 className="font-serif text-2xl text-paper">{L.m.home.hub.popularCountdowns}</h2>
                <Link href={L.href("/days-until")} className="text-sm text-paper-dim hover:text-paper">
                  {L.m.home.hub.everyRecurringDate}
                </Link>
              </div>
              <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {popular.map((s) => (
                  <li key={s.slug} className="ticket flex items-baseline justify-between gap-3 rounded-xl px-4 py-3">
                    <Link href={L.href(`/days-until/${s.slug}`)} className="text-paper hover:text-amber">
                      {displayTitle(L, s)}
                    </Link>
                    <span className="tabular whitespace-nowrap font-mono text-xs text-muted">
                      {s.nextDate ? (typeof s.daysUntil === "number" ? L.fmt.humanDays(s.daysUntil) : L.fmt.shortDate(s.nextDate)) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-14 grid gap-10 lg:grid-cols-[2fr_1fr]">
            <div>
              <div className="flex items-end justify-between gap-4">
                <h2 className="font-serif text-2xl text-paper">{L.m.home.hub.byCountry}</h2>
                <Link href={L.href("/country")} className="text-sm text-paper-dim hover:text-paper">
                  {L.m.home.hub.allCountries}
                </Link>
              </div>
              {topCountries.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{L.m.home.hub.noCountries}</p>
              ) : (
                <ul className="mt-5 flex flex-wrap gap-2">
                  {topCountries.map(([code, n]) => (
                    <li key={code}>
                      <Link href={L.href(`/country/${code.toLowerCase()}`)} className="inline-flex items-baseline gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-paper-dim hover:text-paper">
                        {regionLabel(L, code)}
                        <span className="tabular font-mono text-[10px] text-muted">{L.fmt.number(n)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h2 className="font-serif text-2xl text-paper">{L.m.home.hub.byMonth}</h2>
              <ul className="mt-5 space-y-2 text-sm">
                <li>
                  <Link href={L.href(`/calendar/${thisMonth.year}/${pad2(thisMonth.month)}`)} className="text-paper-dim hover:text-paper">
                    {L.t(L.m.home.hub.thisMonth, { month: L.fmt.monthYear(thisMonth.year, thisMonth.month) })}
                  </Link>
                </li>
                <li>
                  <Link href={L.href(`/calendar/${next.year}/${pad2(next.month)}`)} className="text-paper-dim hover:text-paper">
                    {L.t(L.m.home.hub.nextMonth, { month: L.fmt.monthYear(next.year, next.month) })}
                  </Link>
                </li>
              </ul>
            </div>
          </section>
        </>
      ) : null}

      <CatalogExplorer
        L={L}
        events={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        q={q}
        category={category}
        sort={sort}
        counts={counts}
      />

      <JsonLd data={[webSite(L), organization()]} />
    </div>
  );
}
