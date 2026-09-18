import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CatalogExplorer } from "@/components/CatalogExplorer";
import { Icon } from "@/components/Icon";
import { EventTable } from "@/components/EventTable";
import { FeaturedHero } from "@/components/FeaturedHero";
import { JsonLd } from "@/components/JsonLd";
import { activateLocale } from "@/i18n/request-locale";
import {
  categoryCounts,
  eventsThisWeek,
  featuredUpcoming,
  futureOccurrencesForEvents,
  homeHubMix,
  topSeries,
} from "@/lib/catalog";
import { organization, webSite } from "@/lib/jsonld";
import { CATEGORY_LABELS } from "@/lib/labels";
import {
  formatShortDate,
  HOME_TITLE,
  pad2,
  SITE_DESCRIPTION,
  todayUtc,
  yearMonthOf,
  localizedMetadata,
} from "@/lib/seo";
import { humanDays } from "@/lib/time";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  activateLocale(locale);
  const metadata = await localizedMetadata({
    title: HOME_TITLE,
    description: SITE_DESCRIPTION,
    canonical: "/",
    ogPath: "/og/default",
    locale,
  });
  metadata.title = { absolute: HOME_TITLE };
  return metadata;
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  activateLocale(locale);

  const [highlights, mix, counts, week, popular] = await Promise.all([
    featuredUpcoming(4),
    homeHubMix(12).then(async (result) => ({
      result,
      futureOccurrences: await futureOccurrencesForEvents(result.items),
    })),
    categoryCounts(),
    eventsThisWeek(10),
    topSeries(12),
  ]);
  const { result, futureOccurrences } = mix;
  const featured = highlights[0];
  const more = highlights.slice(1, 4);

  const today = todayUtc();
  const thisMonth = yearMonthOf(today);
  const t = await getTranslations("home");
  return (
    <div className="reveal">
      <div className="mb-7 flex items-end justify-between gap-5">
        <div>
          <h1 className="page-heading">{t("heading")}</h1>
          <p className="page-subtitle">
            Soon, worth watching, and getting attention — mixed so the next one feels right.
          </p>
        </div>
        <time
          dateTime={today}
          className="hidden shrink-0 rounded-full border border-line px-4 py-2.5 text-xs text-paper-dim xl:block"
        >
          {formatShortDate(today)}
        </time>
      </div>
      {featured ? (
        <div className="grid gap-5 xl:grid-cols-[1.85fr_1fr]">
          <FeaturedHero event={featured} />
          <section className="panel flex min-w-0 flex-col p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="section-heading">Also heating up</h2>
              <span className="flex size-8 items-center justify-center rounded-full bg-amber/10 text-amber">
                <Icon name="bolt" size={15} />
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Hype, quality, and how close they are
            </p>
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
                      {event.hype ? ` · ${event.hype.toLocaleString("en-US")} hype` : ""}
                    </p>
                  </div>
                  <Icon name="arrow" size={15} className="text-muted" />
                </Link>
              ))}
            </div>
            <Link href="/#explore" className="button-secondary w-full">
              See the mix <Icon name="arrow" size={15} />
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
      )}
      <CatalogExplorer
        events={result.items}
        futureOccurrences={futureOccurrences}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        sort="hot"
        counts={counts}
        basePath="/search"
      />
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
            The next seven days, weighted toward what people are saving and sharing.
          </p>
          <EventTable events={week} showCategory={false} />
        </div>
        <div className="relative isolate flex flex-col self-start overflow-hidden rounded-3xl border border-white/10 bg-[#1b1730] p-7">
          <div
            aria-hidden="true"
            className="absolute -right-12 -top-12 -z-10 size-64 rounded-full bg-amber/10 blur-3xl"
          />
          <span className="flex size-12 items-center justify-center rounded-2xl border border-amber/20 bg-amber/10 text-amber">
            <Icon name="plus" size={24} />
          </span>
          <h2 className="mt-6 max-w-xs text-2xl font-semibold leading-tight tracking-tight">
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
      <JsonLd data={[webSite(), organization()]} />
    </div>
  );
}
