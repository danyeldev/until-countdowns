import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CalendarButtons } from "@/components/CalendarButtons";
import { Countdown } from "@/components/Countdown";
import { EmbedStudio } from "@/components/EmbedStudio";
import { EventImage } from "@/components/EventImage";
import { EventTable } from "@/components/EventTable";
import { FallbackCard } from "@/components/FallbackCard";
import { ImageCredit } from "@/components/ImageCredit";
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
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { regionSummary } from "@/lib/i18n/regions";
import { i18n, localePage } from "@/lib/i18n/server";
import { eventSeries } from "@/lib/jsonld";
import {
  absoluteUrl,
  buildMetadata,
  displayTitle,
  formatApproximate,
  oembedDiscoveryUrl,
  ogDatedPath,
  seriesDescription,
  seriesHeading,
  seriesTitle,
  siteUrl,
  todayUtc,
} from "@/lib/seo";
import { isCoarsePrecision } from "@/lib/time";

export const revalidate = 3600;

const OCCURRENCE_LIMIT = 60;
const VARIANT_LIMIT = 12;

/** How many of the most popular series are prerendered, in English and in everything else. */
const PRERENDER = { en: 200, other: 60 };

/**
 * The most popular series are prerendered; the rest render on first visit under ISR. The list is
 * shorter outside English because every entry here is built once per locale — fifteen times over,
 * for a tail that is better rendered on the first visit it actually gets.
 */
export async function generateStaticParams() {
  const locale = await localeParam();
  const list = await topSeries(locale === DEFAULT_LOCALE ? PRERENDER.en : PRERENDER.other);
  return list.map((s) => ({ series: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/days-until/[series]">): Promise<Metadata> {
  const L = await i18n();
  const { series: slug } = await params;
  const series = await getSeries(slug);
  if (!series) return { title: L.m.seo.series.fallbackTitle, robots: { index: false, follow: true } };
  const metadata = buildMetadata({
    locale: L.locale,
    title: seriesTitle(L, series),
    description: seriesDescription(L, series),
    canonical: `/days-until/${series.slug}`,
    ogPath: ogDatedPath("series", series.slug, todayUtc()),
    // A series with no future occurrence is a thin page: reachable, out of the index and the sitemap.
    noindex: !series.nextDate,
  });
  // Same gate as the embed itself: a dormant series, or one whose next occurrence is only pinned to
  // a month, has nothing to hand an oEmbed consumer, so it does not claim it can.
  if (series.nextDate && !isCoarsePrecision(series.nextPrecision)) {
    metadata.alternates = {
      ...metadata.alternates,
      types: { "application/json+oembed": oembedDiscoveryUrl(L.locale, `/days-until/${series.slug}`) },
    };
  }
  return metadata;
}

export default async function SeriesPage({ params }: PageProps<"/[locale]/days-until/[series]">) {
  const L = await localePage();
  const { series: slug } = await params;
  const series = await getSeriesStrict(slug);
  if (!series) {
    const canonical = await resolveSeriesAliasStrict(slug);
    if (canonical) permanentRedirect(L.href(`/days-until/${canonical}`));
    notFound();
  }

  const [{ canonical: occurrences, variants }, siblings] = await Promise.all([
    seriesOccurrencesSplit(series.slug, OCCURRENCE_LIMIT),
    seriesInCategory(series.category, 13),
  ]);
  // `series.next*` already comes from the guarded list (see catalog.ts); the table agrees with it.
  const next = occurrences.find((o) => o.slug === series.nextSlug) ?? occurrences[0];
  const related = siblings.filter((s) => s.slug !== series.slug).slice(0, 12);
  // App-internal path of this page: the crumbs and the JSON-LD localize it themselves, while
  // anything a reader copies or a calendar entry links back to takes the locale's own URL.
  const path = `/days-until/${series.slug}`;
  const sharePath = L.href(path);
  const regions = regionSummary(L, series.regions);
  const title = displayTitle(L, series);
  const categoryLabel = L.m.categories.labels[series.category];
  // German capitalises its nouns mid-sentence, so whether the related-series heading lower-cases the
  // category label is the locale's own call — the same flag the category hub titles read.
  const relatedCategory = L.m.seo.hub.lowercaseCategory ? categoryLabel.toLocaleLowerCase(L.tag) : categoryLabel;

  return (
    <article>
      <Breadcrumbs
        items={[
          { name: L.m.common.breadcrumb.home, path: "/" },
          { name: categoryLabel, path: `/category/${series.category}` },
          { name: title, path },
        ]}
      />
      <p className="mt-6 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-amber">
        <Link href={L.href(`/category/${series.category}`)} className="hover:text-paper">
          {categoryLabel}
        </Link>
        <span className="text-muted">{L.m.common.labels.recurring}</span>
      </p>
      <h1 className="mt-3 font-serif text-4xl leading-tight text-paper sm:text-6xl">{seriesHeading(L, series)}</h1>
      {series.nextDate ? (
        <IntentAnswer
          className="mt-5 max-w-2xl"
          title={title}
          date={series.nextDate}
          days={series.daysUntil}
          precision={series.nextPrecision}
          status={next?.status}
        />
      ) : (
        <p className="mt-5 max-w-2xl text-lg text-paper-dim">{L.t(L.m.series.noUpcoming, { title })}</p>
      )}
      {series.description ? <p className="mt-4 max-w-2xl text-lg text-paper-dim">{series.description}</p> : null}
      {series.summary && series.summary !== series.description ? (
        <p className="mt-3 max-w-2xl text-paper-dim">{series.summary}</p>
      ) : null}
      <p className="mt-3 font-mono text-sm text-muted">{regions}</p>

      {/* The series picture is the one its next occurrence carries (the enrichment run copies the
          first licensed image it finds onto `series.image_id` too); otherwise the designed card. */}
      <figure className="mt-10">
        {next?.image ? (
          <>
            <EventImage
              image={next.image}
              alt={title}
              variant="hero"
              priority
              className="rounded-3xl border border-line"
            />
            <ImageCredit image={next.image} className="mt-2" />
          </>
        ) : (
          <FallbackCard
            slug={series.slug}
            title={title}
            category={series.category}
            variant="hero"
            className="rounded-3xl border border-line"
          />
        )}
      </figure>

      {series.nextDate ? (
        <div className="ticket mt-10 rounded-3xl px-6 py-10 sm:px-10">
          <Countdown
            date={series.nextDate}
            allDay={series.nextAllDay ?? true}
            size="hero"
            initialDays={series.daysUntil}
            precision={series.nextPrecision}
            locale={L.locale}
            labels={L.m.embed.countdown}
            approximate={formatApproximate(L, series.nextDate, series.nextPrecision)}
          />
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {next ? <CalendarButtons event={next} url={absoluteUrl(sharePath)} labels={L.m.common.actions} /> : null}
        {next ? (
          <Link
            href={L.href(`/event/${next.slug}`)}
            className="rounded-full border border-line px-4 py-2 text-sm text-paper hover:border-amber/50 hover:text-amber"
          >
            {L.m.series.thisYearsPage}
          </Link>
        ) : null}
        <ShareButton title={L.t(L.m.series.shareTitle, { title })} path={sharePath} labels={L.m.common.actions} />
      </div>

      {/* The embed follows the series, not one occurrence: a widget put up for Christmas 2026
          keeps ticking to Christmas 2027 the day after, without the owner touching the snippet. */}
      {series.nextDate && !isCoarsePrecision(series.nextPrecision) ? (
        <EmbedStudio slug={series.slug} title={title} origin={siteUrl()} labels={L.m.embed.studio} actions={L.m.common.actions} />
      ) : null}

      <section className="mt-14">
        <h2 className="font-serif text-2xl text-paper">{L.m.series.upcoming.heading}</h2>
        <p className="mt-1 text-sm text-muted">{L.t(L.m.series.upcoming.note, { title })}</p>
        <EventTable events={occurrences} showCategory={false} emptyText={L.m.series.upcoming.empty} />
      </section>

      {variants.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-serif text-xl text-paper">{L.m.series.variants.heading}</h2>
          <p className="mt-1 text-sm text-muted">{L.m.series.variants.note}</p>
          <EventTable events={variants.slice(0, VARIANT_LIMIT)} showCategory={false} />
        </section>
      ) : null}

      {/* The curated Q&A is written once, in English, and stored on the row — there is no translated
          copy to fall back on. An English question and answer inside a Spanish page is mixed-language
          content, which costs the page the ranking the rest of this file exists to win, so outside
          English the block is simply not rendered. */}
      {L.locale === DEFAULT_LOCALE && series.faq.length > 0 ? (
        <section className="mt-14 max-w-2xl">
          <h2 className="font-serif text-2xl text-paper">{L.m.series.faqHeading}</h2>
          <dl className="mt-4 space-y-5">
            {series.faq.map((item) => (
              <div key={item.question}>
                <dt className="font-medium text-paper">{item.question}</dt>
                <dd className="mt-1 text-paper-dim">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {series.tags.length > 0 ? (
        <p className="mt-10 flex flex-wrap items-center gap-2 text-sm text-muted">
          {L.m.series.tagsLabel}
          {series.tags.map((tag) => (
            <Link key={tag} href={L.href(`/tag/${encodeURIComponent(tag)}`)} className="rounded-full border border-line px-2 py-0.5 text-xs text-paper-dim hover:text-paper">
              {tag}
            </Link>
          ))}
        </p>
      ) : null}

      {related.length > 0 ? (
        <section className="mt-14">
          <h2 className="font-serif text-2xl text-paper">
            {L.t(L.m.series.related.heading, { category: relatedCategory })}
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((s) => (
              <li key={s.slug} className="ticket flex items-baseline justify-between gap-3 rounded-xl px-4 py-3">
                <Link href={L.href(`/days-until/${s.slug}`)} className="text-paper hover:text-amber">
                  {displayTitle(L, s)}
                </Link>
                <span className="tabular whitespace-nowrap font-mono text-xs text-muted">
                  {s.nextDate
                    ? typeof s.daysUntil === "number"
                      ? L.fmt.humanDays(s.daysUntil)
                      : L.fmt.shortDate(s.nextDate)
                    : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            <Link href={L.href("/days-until")} className="text-amber underline hover:text-paper">
              {L.m.series.related.all}
            </Link>
          </p>
        </section>
      ) : null}

      <JsonLd data={eventSeries(L, series, occurrences)} />
    </article>
  );
}
