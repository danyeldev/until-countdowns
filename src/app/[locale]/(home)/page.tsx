import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { localeOf } from "@/i18n/locales";
import { Link, redirect } from "@/i18n/navigation";
import { after } from "next/server";
import { CatalogExplorer } from "@/components/CatalogExplorer";
import { Icon } from "@/components/Icon";
import { EventTable } from "@/components/EventTable";
import { FeaturedHero } from "@/components/FeaturedHero";
import { JsonLd } from "@/components/JsonLd";
import {
  categoryCounts,
  eventsThisWeek,
  featuredUpcoming,
  futureOccurrencesForEvents,
  logSearch,
  searchEvents,
  topSeries,
} from "@/lib/catalog";
import { organization, webSite } from "@/lib/jsonld";
import { searchCollections } from "@/lib/search-collections-server";
import { CATEGORY_LABELS } from "@/lib/labels";
import {
  formatShortDate,
  HOME_TITLE,
  pad2,
  SITE_DESCRIPTION,
  todayUtc,
  yearMonthOf, localizedMetadata } from "@/lib/seo";
import { humanDays } from "@/lib/time";
import {
  CATEGORIES,
  DEFAULT_EVENT_SORT,
  isEventSort,
  type Category,
  type EventSort,
} from "@/lib/types";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

type HomeQuery = {
  q?: string;
  category?: Category;
  sort: EventSort;
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
  const sort: EventSort = isEventSort(sortRaw) ? sortRaw : DEFAULT_EVENT_SORT;
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
  params,
  searchParams,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const { filtered } = parseQuery(await searchParams);
  const metadata = await localizedMetadata({
    title: HOME_TITLE,
    description: SITE_DESCRIPTION,
    canonical: "/",
    ogPath: "/og/default",
    noindex: filtered,
    locale,
  });
  // The layout template appends "· Until"; the home title already names the site.
  metadata.title = { absolute: HOME_TITLE };
  return metadata;
}

export default async function Home({ params, searchParams }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const { q, category, sort, page, hub } = parseQuery(await searchParams);

  const [highlights, result, counts, next7, popular, collections] = await Promise.all([
    hub ? featuredUpcoming(4) : [],
    searchEvents({ q, category, sort, page, pageSize: 12 }),
    categoryCounts(),
    hub ? eventsThisWeek(10) : [],
    hub ? topSeries(12) : [],
    q && page === 1 ? searchCollections(q, 6) : Promise.resolve([]),
  ]);
  const featured = highlights[0];
  const futureOccurrences = await futureOccurrencesForEvents(result.items);
  const more = highlights.slice(1, 4);
  const week = next7;

  // Past the end of the result window (a stale deep link, or the catalog shrank): the RPC returns
  // no rows and therefore no total, which would strip the pagination UI. Send the visitor to page 1
  // of the same query instead of a dead end.
  if (result.items.length === 0 && page > 1) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (category) p.set("category", category);
    if (sort !== DEFAULT_EVENT_SORT) p.set("sort", sort);
    const qs = p.toString();
    redirect({ href: qs ? `/?${qs}` : "/", locale: localeOf(locale) });
  }

  if (q) {
    const total = result.total;
    after(() => logSearch(q, total));
  }

  const today = todayUtc();
  const thisMonth = yearMonthOf(today);
  const t = await getTranslations("home");
  const nav = await getTranslations("nav");
  return (
    <div className="reveal">
      <div className="mb-8 flex items-end justify-between gap-5">
        <div>
          <h1 className="page-heading">
            {hub ? t("heading") : q ? t("resultsFor", { query: q }) : nav("explore")}
          </h1>
          {!q && (
            <p className="page-subtitle">
              {hub
                ? "Soon, worth watching, and getting attention — mixed so the next one feels right."
                : "Find your next event, holiday or favorite tradition."}
            </p>
          )}
        </div>
        {hub && (
          <time dateTime={today} className="hidden shrink-0 text-sm text-muted xl:block">
            {formatShortDate(today)}
          </time>
        )}
      </div>
      {hub &&
        (featured ? (
          <div className="grid gap-8 xl:grid-cols-[1.85fr_1fr] xl:gap-10">
            <FeaturedHero event={featured} />
            <section className="flex min-w-0 flex-col">
              <h2 className="section-heading">Also heating up</h2>
              <p className="mt-1 text-sm text-muted">
                Hype, quality, and how close they are
              </p>
              <div className="mt-2 flex flex-1 flex-col divide-y divide-line">
                {more.map((event) => (
                  <Link
                    key={event.id}
                    href={`/event/${event.slug}`}
                    className="group flex flex-1 items-center gap-4 py-4"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-amber">
                      <Icon
                        name={
                          event.category === "sports"
                            ? "trophy"
                            : event.category === "space"
                              ? "spark"
                              : "calendar"
                        }
                        size={18}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted">
                        {CATEGORY_LABELS[event.category]}
                      </p>
                      <h3 className="mt-0.5 line-clamp-2 text-[15px] font-medium leading-snug group-hover:text-amber">
                        {event.title}
                      </h3>
                      <p className="mt-1 text-xs text-paper-dim">
                        {event.daysUntil != null
                          ? humanDays(event.daysUntil)
                          : formatShortDate(event.date, event.timezone)}
                        {event.hype ? ` · ${event.hype.toLocaleString("en-US")} hype` : ""}
                      </p>
                    </div>
                    <Icon name="arrow" size={15} className="text-muted/60 group-hover:text-amber" />
                  </Link>
                ))}
              </div>
              <Link
                href="/#explore"
                className="mt-2 inline-flex min-h-11 items-center gap-2 self-start text-sm text-amber hover:text-paper"
              >
                See the mix <Icon name="arrow" size={15} />
              </Link>
            </section>
          </div>
        ) : (
          <section className="py-8">
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
        collections={collections}
      />
      {hub && (
        <>
          <section className="mt-20 grid gap-12 xl:grid-cols-[1.7fr_1fr] xl:gap-16">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-4">
                <h2 className="section-heading">This week</h2>
                <Link
                  href={`/calendar/${thisMonth.year}/${pad2(thisMonth.month)}`}
                  className="inline-flex min-h-11 items-center gap-2 text-sm text-amber hover:text-paper"
                >
                  Open calendar <Icon name="arrow" size={14} />
                </Link>
              </div>
              <p className="mt-1 text-sm text-muted">
                The next seven days, weighted toward what people are saving and sharing.
              </p>
              <EventTable events={week} showCategory={false} />
            </div>
            <div className="self-start xl:pt-1">
              <span className="flex size-10 items-center justify-center rounded-full bg-amber/15 text-amber">
                <Icon name="plus" size={20} />
              </span>
              <h2 className="mt-5 max-w-xs text-2xl font-semibold leading-tight tracking-tight">
                Your life has big dates, too.
              </h2>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
                The trip. The birthday. The fresh start. Give it a countdown of
                its own.
              </p>
              <Link href="/create" className="button-primary mt-6">
                Make it yours <Icon name="arrow" size={16} />
              </Link>
            </div>
          </section>
          {popular.length > 0 && (
            <section className="mt-20">
              <div className="flex items-center justify-between gap-4">
                <h2 className="section-heading">Good things come around</h2>
                <Link
                  href="/days-until"
                  className="inline-flex min-h-11 items-center gap-2 text-sm text-amber hover:text-paper"
                >
                  Every year <Icon name="arrow" size={14} />
                </Link>
              </div>
              <p className="mt-1 text-sm text-muted">
                Follow the next date. Explore the years ahead.
              </p>
              <ul className="mt-4 grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
                {popular.slice(0, 6).map((series) => (
                  <li key={series.slug} className="border-t border-line">
                    <Link
                      href={`/days-until/${series.slug}`}
                      className="group flex min-h-[64px] items-center justify-between gap-3 py-4"
                    >
                      <span className="text-[15px] font-medium group-hover:text-amber">
                        {series.title}
                      </span>
                      <span className="shrink-0 text-sm text-muted">
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
