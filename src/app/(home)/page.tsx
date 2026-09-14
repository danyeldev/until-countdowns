import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { CatalogExplorer } from "@/components/CatalogExplorer";
import { Icon } from "@/components/Icon";
import { EventTable } from "@/components/EventTable";
import { FeaturedHero } from "@/components/FeaturedHero";
import { JsonLd } from "@/components/JsonLd";
import {
  categoryCounts,
  eventsWithinDays,
  featuredUpcoming,
  futureOccurrencesForEvents,
  logSearch,
  searchEvents,
  topSeries,
} from "@/lib/catalog";
import { organization, webSite } from "@/lib/jsonld";
import { CATEGORY_LABELS } from "@/lib/labels";
import {
  buildMetadata,
  formatShortDate,
  HOME_TITLE,
  pad2,
  SITE_DESCRIPTION,
  todayUtc,
  yearMonthOf,
} from "@/lib/seo";
import { humanDays } from "@/lib/time";
import { CATEGORIES, type Category } from "@/lib/types";

const SORTS = ["soonest", "popular", "latest"] as const;
type Sort = (typeof SORTS)[number];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

type HomeQuery = {
  q?: string;
  category?: Category;
  sort: Sort;
  page: number;
  hub: boolean;
  filtered: boolean;
};

function parseQuery(
  sp: Record<string, string | string[] | undefined>,
): HomeQuery {
  const q = first(sp.q)?.trim().slice(0, 80) || undefined;
  const categoryRaw = first(sp.category);
  const category = CATEGORIES.includes(categoryRaw as Category)
    ? (categoryRaw as Category)
    : undefined;
  const sortRaw = first(sp.sort);
  const sort: Sort = SORTS.includes(sortRaw as Sort)
    ? (sortRaw as Sort)
    : "soonest";
  const page = Math.min(
    1000,
    Math.max(1, Math.floor(Number(first(sp.page))) || 1),
  );
  return {
    q,
    category,
    sort,
    page,
    hub: !q && !category && !sortRaw && page === 1,
    // Any query variant (`?q=`, `?sort=`, `?page=2`, `?category=`) is a filtered view of `/`.
    filtered: Boolean(q || categoryRaw || sortRaw || page > 1),
  };
}

/** The home page already reads `searchParams`, so metadata reading them makes nothing more dynamic. */
export async function generateMetadata({
  searchParams,
}: PageProps<"/">): Promise<Metadata> {
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

  const [highlights, result, counts, next7, popular] = await Promise.all([
    hub ? featuredUpcoming(4) : [],
    searchEvents({ q, category, sort, page, pageSize: 12 }),
    categoryCounts(),
    hub
      ? eventsWithinDays({
          minDays: 0,
          maxDays: 7,
          sort: "popular",
          limit: 10,
        })
      : [],
    hub ? topSeries(12) : [],
  ]);
  const featured = highlights[0];
  const futureOccurrences = await futureOccurrencesForEvents(result.items);
  const more = highlights.slice(1, 4);
  // Popularity picks the ten rows; the table promises a day-by-day view, so render them in date order.
  next7.sort(
    (a, b) => a.date.localeCompare(b.date) || b.popularity - a.popularity,
  );

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
  return (
    <div className="reveal">
      <div className="mb-7 flex items-end justify-between gap-5">
        <div>
          <h1 className="page-heading">
            {hub
              ? "Something to look forward to."
              : q
                ? `Results for “${q}”`
                : "Explore countdowns"}
          </h1>
          {!q && (
            <p className="page-subtitle">
              {hub
                ? "Big moments. Little milestones. Keep your next one close."
                : "Find your next event, holiday or favorite tradition."}
            </p>
          )}
        </div>
        {hub && (
          <time
            dateTime={today}
            className="hidden shrink-0 rounded-full border border-line px-4 py-2.5 text-xs text-paper-dim xl:block"
          >
            {formatShortDate(today)}
          </time>
        )}
      </div>
      {hub &&
        (featured ? (
          <div className="grid gap-5 xl:grid-cols-[1.85fr_1fr]">
            <FeaturedHero event={featured} />
            <section className="panel flex min-w-0 flex-col p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="section-heading">On the horizon</h2>
                <span className="flex size-8 items-center justify-center rounded-full bg-amber/10 text-amber">
                  <Icon name="bolt" size={15} />
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">A few more worth saving</p>
              <div className="my-3 flex flex-1 flex-col divide-y divide-line/60">
                {more.map((event) => (
                  <Link
                    key={event.id}
                    href={`/event/${event.slug}`}
                    className="group flex flex-1 items-center gap-3 py-5"
                  >
                    <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-white/5 text-amber">
                      <Icon
                        name={
                          event.category === "sports"
                            ? "trophy"
                            : event.category === "space"
                              ? "spark"
                              : "calendar"
                        }
                        size={22}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-muted">
                        {CATEGORY_LABELS[event.category]}
                      </p>
                      <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-snug group-hover:text-amber">
                        {event.title}
                      </h3>
                      <p className="mt-1 text-xs text-paper-dim">
                        {event.daysUntil != null
                          ? humanDays(event.daysUntil)
                          : formatShortDate(event.date, event.timezone)}
                      </p>
                    </div>
                    <Icon name="arrow" size={15} className="text-muted" />
                  </Link>
                ))}
              </div>
              <Link
                href="/?sort=popular#explore"
                className="button-secondary w-full"
              >
                Explore popular <Icon name="arrow" size={15} />
              </Link>
            </section>
          </div>
        ) : (
          <section className="panel p-8">
            <h2 className="section-heading">Make room for your next moment.</h2>
            <p className="page-subtitle">
              The catalog is taking a moment to load. Create a countdown for a
              date of your own.
            </p>
            <Link href="/create" className="button-primary mt-5">
              Create a countdown <Icon name="plus" />
            </Link>
          </section>
        ))}
      <CatalogExplorer
        events={result.items}
        futureOccurrences={futureOccurrences}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        q={q}
        category={category}
        sort={sort}
        counts={counts}
      />
      {hub && (
        <>
          <section className="mt-12 grid gap-7 xl:grid-cols-[1.7fr_1fr]">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-4">
                <h2 className="section-heading">This week</h2>
                <Link
                  href={`/calendar/${thisMonth.year}/${pad2(thisMonth.month)}`}
                  className="inline-flex min-h-11 items-center gap-2 text-xs text-amber"
                >
                  Open calendar <Icon name="arrow" size={14} />
                </Link>
              </div>
              <p className="mt-1 text-sm text-muted">
                Highlights from the next seven days.
              </p>
              <EventTable events={next7} showCategory={false} />
            </div>
            <div className="relative isolate flex min-h-[300px] flex-col justify-end overflow-hidden rounded-3xl border border-white/10 bg-[#1b1730] p-7">
              <div
                aria-hidden="true"
                className="absolute -right-12 -top-12 -z-10 size-64 rounded-full bg-amber/10 blur-3xl"
              />
              <span className="mb-auto flex size-12 items-center justify-center rounded-2xl border border-amber/20 bg-amber/10 text-amber">
                <Icon name="plus" size={24} />
              </span>
              <h2 className="mt-8 max-w-xs text-2xl font-semibold leading-tight tracking-tight">
                Your life has big dates, too.
              </h2>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-paper-dim">
                The trip. The birthday. The fresh start. Give it a countdown of
                its own.
              </p>
              <Link href="/create" className="button-primary mt-6 self-start">
                Make it yours <Icon name="arrow" size={16} />
              </Link>
            </div>
          </section>
          {popular.length > 0 && (
            <section className="mt-12">
              <div className="flex items-center justify-between gap-4">
                <h2 className="section-heading">Good things come around</h2>
                <Link
                  href="/days-until"
                  className="inline-flex min-h-11 items-center gap-2 text-xs text-amber"
                >
                  Every year <Icon name="arrow" size={14} />
                </Link>
              </div>
              <p className="mt-1 text-sm text-muted">
                Follow the next date. Explore the years ahead.
              </p>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {popular.slice(0, 6).map((series) => (
                  <li key={series.slug}>
                    <Link
                      href={`/days-until/${series.slug}`}
                      className="flex min-h-[76px] items-center justify-between gap-3 rounded-2xl border border-line bg-ink-2 px-5 py-4 hover:border-amber/40"
                    >
                      <span className="text-sm font-medium">
                        {series.title}
                      </span>
                      <span className="shrink-0 text-xs text-amber">
                        {series.nextDate
                          ? typeof series.daysUntil === "number"
                            ? humanDays(series.daysUntil)
                            : formatShortDate(
                                series.nextDate,
                                series.nextTimezone,
                              )
                          : "View dates"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <JsonLd data={[webSite(), organization()]} />
    </div>
  );
}
