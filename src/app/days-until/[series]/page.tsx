import { prerenderLimit } from "@/lib/prerender";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CalendarButtons } from "@/components/CalendarButtons";
import { DetailHero } from "@/components/DetailHero";
import { YearTimeline } from "@/components/YearTimeline";
import { Icon } from "@/components/Icon";
import { EmbedStudio } from "@/components/EmbedStudio";
import { EventTable } from "@/components/EventTable";
import { IntentAnswer } from "@/components/IntentAnswer";
import { JsonLd } from "@/components/JsonLd";
import { ShareButton } from "@/components/ShareButton";
import {
  getSeries,
  getSeriesStrict,
  resolveSeriesAliasStrict,
  seriesInCategory,
  seriesOccurrencesSplit,
  topSeries,
} from "@/lib/catalog";
import { eventSeries } from "@/lib/jsonld";
import { CATEGORY_LABELS, sourceLabel } from "@/lib/labels";
import { regionSummary } from "@/lib/regions";
import {
  absoluteUrl,
  buildMetadata,
  formatShortDate,
  oembedDiscoveryUrl,
  ogDatedPath,
  seriesDescription,
  seriesTitle,
  siteUrl,
  todayUtc,
} from "@/lib/seo";
import {
  formatApproximate,
  formatCompactDate,
  humanDays,
  isCoarsePrecision,
} from "@/lib/time";

export const revalidate = 3600;

const OCCURRENCE_LIMIT = 60;
const VARIANT_LIMIT = 12;

/** Optionally warm popular series; default is on-demand ISR. */
export async function generateStaticParams() {
  const limit = prerenderLimit(200);
  if (!limit) return [];
  const list = await topSeries(limit);
  return list.map((s) => ({ series: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ series: string }>;
}): Promise<Metadata> {
  const { series: slug } = await params;
  const series = await getSeries(slug);
  if (!series)
    return { title: "Days until", robots: { index: false, follow: true } };
  const metadata = buildMetadata({
    title: seriesTitle(series),
    description: seriesDescription(series),
    canonical: `/days-until/${series.slug}`,
    ogPath: ogDatedPath("series", series.slug, todayUtc()),
    // A series with no future occurrence is a thin page: reachable, out of the index and the sitemap.
    noindex: !series.nextDate,
  });
  // Same gate as the embed itself: a dormant series, or one whose next occurrence is only pinned to
  // a month, has nothing to hand an oEmbed consumer, so it does not claim it can.
  if (
    series.nextDate &&
    !isCoarsePrecision(series.nextPrecision) &&
    !["cancelled", "postponed", "retired"].includes(series.nextStatus ?? "")
  ) {
    metadata.alternates = {
      ...metadata.alternates,
      types: {
        "application/json+oembed": oembedDiscoveryUrl(
          `/days-until/${series.slug}`,
        ),
      },
    };
  }
  return metadata;
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ series: string }>;
}) {
  const { series: slug } = await params;
  const series = await getSeriesStrict(slug);
  if (!series) {
    const canonical = await resolveSeriesAliasStrict(slug);
    if (canonical) permanentRedirect(`/days-until/${canonical}`);
    notFound();
  }

  const [{ canonical: occurrences, variants }, siblings] = await Promise.all([
    seriesOccurrencesSplit(series.slug, OCCURRENCE_LIMIT),
    seriesInCategory(series.category, 13),
  ]);
  // `series.next*` already comes from the guarded list (see catalog.ts); the table agrees with it.
  const next =
    occurrences.find((o) => o.slug === series.nextSlug) ?? occurrences[0];
  const related = siblings.filter((s) => s.slug !== series.slug).slice(0, 12);
  const path = `/days-until/${series.slug}`;
  const regions = regionSummary(series.regions);

  return (
    <article className="pb-4">
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          {
            name: CATEGORY_LABELS[series.category],
            path: `/category/${series.category}`,
          },
          { name: series.title, path },
        ]}
      />
      <DetailHero
        title={series.title}
        kicker={
          <>
            <Link
              href={`/category/${series.category}`}
              className="rounded-md hover:text-paper"
            >
              {CATEGORY_LABELS[series.category]}
            </Link>
            <span className="rounded-md border border-line bg-ink/60 px-2 py-1 text-xs text-paper-dim">
              Recurring countdown
            </span>
          </>
        }
        date={series.nextDate}
        allDay={series.nextAllDay ?? true}
        timezone={series.nextTimezone}
        initialDays={series.daysUntil}
        precision={series.nextPrecision}
        status={series.nextStatus ?? next?.status}
        image={next?.image}
        actions={
          <>
            {next ? (
              <Link
                href={`/event/${next.slug}`}
                className="button-primary gap-2"
              >
                Open next date <Icon name="arrow" size={17} />
              </Link>
            ) : null}
            {next ? (
              <CalendarButtons event={next} url={absoluteUrl(path)} />
            ) : null}
            <ShareButton title={`Days until ${series.title}`} path={path} />
          </>
        }
      />

      <section className="mt-8" aria-labelledby="upcoming-dates-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="upcoming-dates-heading" className="section-heading">
              Pick your date
            </h2>
            <p className="mt-1 text-sm text-muted">
              Every upcoming {series.title} in the catalog, soonest first.
            </p>
          </div>
          {occurrences.length ? (
            <span className="rounded-lg border border-line bg-ink-2 px-3 py-2 text-sm text-paper-dim tabular-nums">
              {occurrences.length} {occurrences.length === 1 ? "date" : "dates"}
            </span>
          ) : null}
        </div>
        {occurrences.length ? (
          <YearTimeline events={occurrences.slice(0, 8)} />
        ) : (
          <p className="empty-state mt-5 text-sm text-muted">
            No future dates yet. Check back after the next refresh.
          </p>
        )}
        {occurrences.length > 8 ? (
          <details className="group/dates mt-4 rounded-2xl border border-line bg-ink-2 px-4 sm:px-5">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-paper [&::-webkit-details-marker]:hidden">
              Show {occurrences.length - 8} later dates
              <Icon
                name="plus"
                size={17}
                className="text-muted transition-transform group-open/dates:rotate-45"
              />
            </summary>
            <div className="pb-5">
              <EventTable events={occurrences.slice(8)} showCategory={false} />
            </div>
          </details>
        ) : null}
      </section>

      <div className="mt-8 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.48fr)]">
        <section className="panel min-w-0 rounded-2xl border border-line bg-ink-2 p-5 sm:p-6">
          <h2 className="section-heading">About {series.title}</h2>
          {series.nextDate ? (
            <IntentAnswer
              className="mt-4"
              title={series.title}
              date={series.nextDate}
              days={series.daysUntil}
              precision={series.nextPrecision}
              status={series.nextStatus ?? next?.status}
              timezone={series.nextTimezone}
            />
          ) : null}
          {series.description ? (
            <p className="mt-4 text-sm leading-relaxed text-paper-dim">
              {series.description}
            </p>
          ) : null}
          <p className="mt-5 flex items-start gap-2 border-t border-line pt-5 text-sm text-muted">
            <Icon name="globe" size={17} className="mt-0.5 shrink-0" />
            {regions}
          </p>
          {series.tags.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {series.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/tag/${encodeURIComponent(tag)}`}
                  className="inline-flex min-h-11 items-center rounded-xl border border-line bg-ink px-3 text-xs text-paper-dim hover:border-amber/40 hover:text-amber"
                >
                  {tag}
                </Link>
              ))}
            </div>
          ) : null}
        </section>
        <aside className="panel rounded-2xl border border-line bg-ink-2 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-amber">
            <Icon name="calendar" size={17} />
            <h2 className="text-sm font-medium text-paper">
              One page. Every year.
            </h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            This countdown follows the next available date. Choose a year to
            open that exact occurrence.
          </p>
          {next ? (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-xs text-muted">Next date provided by</p>
              <p className="mt-2 text-sm text-paper-dim">
                {next.sourceUrl ? (
                  <a
                    href={next.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 text-amber hover:underline"
                  >
                    {next.sourceLabel || sourceLabel(next.source)}
                    <Icon name="arrow" size={15} />
                  </a>
                ) : (
                  next.sourceLabel || sourceLabel(next.source)
                )}
              </p>
              {next.lastVerifiedAt ? (
                <p className="mt-1 text-xs text-muted">
                  Last verified{" "}
                  {formatCompactDate(next.lastVerifiedAt.slice(0, 10))}
                </p>
              ) : null}
            </div>
          ) : null}
          <Link
            href="/attributions"
            className="mt-3 inline-flex min-h-11 items-center text-xs text-paper-dim underline decoration-line underline-offset-4 hover:text-paper"
          >
            Sources and attributions
          </Link>
        </aside>
      </div>

      {series.nextDate &&
      !isCoarsePrecision(series.nextPrecision) &&
      !["cancelled", "postponed", "retired"].includes(
        series.nextStatus ?? next?.status ?? "",
      ) ? (
        <EmbedStudio
          slug={series.slug}
          title={series.title}
          origin={siteUrl()}
        />
      ) : null}

      {variants.length ? (
        <section className="mt-10">
          <h2 className="section-heading">Regional dates</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Related observances on different days in some countries. These are
            listed separately from the main date above.
          </p>
          <EventTable
            events={variants.slice(0, VARIANT_LIMIT)}
            showCategory={false}
          />
        </section>
      ) : null}

      {series.faq.length ? (
        <section className="mt-10">
          <h2 className="section-heading">Good to know</h2>
          <div className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-ink-2">
            {series.faq.map((item) => (
              <details key={item.question} className="group/faq px-5 sm:px-6">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-paper [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <Icon
                    name="plus"
                    size={17}
                    className="shrink-0 text-muted transition-transform group-open/faq:rotate-45"
                  />
                </summary>
                <p className="max-w-3xl pb-5 text-sm leading-relaxed text-paper-dim">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {related.length ? (
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-heading">More recurring moments</h2>
            <Link
              href="/days-until"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-amber hover:text-paper"
            >
              Explore all
              <Icon name="arrow" size={16} />
            </Link>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {related.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/days-until/${s.slug}`}
                  className="group flex h-full items-center justify-between gap-3 rounded-2xl border border-line bg-ink-2 p-5 transition-colors hover:border-amber/40"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-paper group-hover:text-amber">
                      {s.title}
                    </span>
                    <span className="mt-2 block text-xs text-muted">
                      {s.nextDate
                        ? isCoarsePrecision(s.nextPrecision)
                          ? formatApproximate(s.nextDate, s.nextPrecision)
                          : typeof s.daysUntil === "number"
                            ? humanDays(s.daysUntil)
                            : formatShortDate(s.nextDate, s.nextTimezone)
                        : "Next date pending"}
                    </span>
                  </span>
                  <Icon
                    name="arrow"
                    size={17}
                    className="shrink-0 text-muted group-hover:text-amber"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <JsonLd data={eventSeries(series, occurrences)} />
    </article>
  );
}
