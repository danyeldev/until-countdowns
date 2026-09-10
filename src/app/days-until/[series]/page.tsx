import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
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
import { eventSeries } from "@/lib/jsonld";
import { CATEGORY_LABELS } from "@/lib/labels";
import { regionSummary } from "@/lib/regions";
import {
  buildMetadata,
  formatShortDate,
  oembedDiscoveryUrl,
  ogDatedPath,
  seriesDescription,
  seriesTitle,
  siteUrl,
  todayUtc,
} from "@/lib/seo";
import { humanDays, isCoarsePrecision } from "@/lib/time";

export const revalidate = 3600;

const OCCURRENCE_LIMIT = 60;
const VARIANT_LIMIT = 12;

/** Top 200 series by popularity are prerendered; the rest render on first visit under ISR. */
export async function generateStaticParams() {
  const list = await topSeries(200);
  return list.map((s) => ({ series: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ series: string }> }): Promise<Metadata> {
  const { series: slug } = await params;
  const series = await getSeries(slug);
  if (!series) return { title: "Days until", robots: { index: false, follow: true } };
  const metadata = buildMetadata({
    title: seriesTitle(series),
    description: seriesDescription(series),
    canonical: `/days-until/${series.slug}`,
    ogPath: ogDatedPath("series", series.slug, todayUtc()),
    // A series with no future occurrence is a thin page: reachable, out of the index and the sitemap.
    noindex: !series.nextDate,
  });
  metadata.alternates = {
    ...metadata.alternates,
    types: { "application/json+oembed": oembedDiscoveryUrl(`/days-until/${series.slug}`) },
  };
  return metadata;
}

export default async function SeriesPage({ params }: { params: Promise<{ series: string }> }) {
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
  const next = occurrences.find((o) => o.slug === series.nextSlug) ?? occurrences[0];
  const related = siblings.filter((s) => s.slug !== series.slug).slice(0, 12);
  const path = `/days-until/${series.slug}`;
  const regions = regionSummary(series.regions);

  return (
    <article>
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: CATEGORY_LABELS[series.category], path: `/category/${series.category}` },
          { name: series.title, path },
        ]}
      />
      <p className="mt-6 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-amber">
        <Link href={`/category/${series.category}`} className="hover:text-paper">
          {CATEGORY_LABELS[series.category]}
        </Link>
        <span className="text-muted">Recurring</span>
      </p>
      <h1 className="mt-3 font-serif text-4xl leading-tight text-paper sm:text-6xl">
        How many days until {series.title}?
      </h1>
      {series.nextDate ? (
        <IntentAnswer
          className="mt-5 max-w-2xl"
          title={series.title}
          date={series.nextDate}
          days={series.daysUntil}
          precision={series.nextPrecision}
          status={next?.status}
        />
      ) : (
        <p className="mt-5 max-w-2xl text-lg text-paper-dim">
          No upcoming date for {series.title} is in the catalog yet.
        </p>
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
              alt={series.title}
              variant="hero"
              priority
              className="rounded-3xl border border-line"
            />
            <ImageCredit image={next.image} className="mt-2" />
          </>
        ) : (
          <FallbackCard
            slug={series.slug}
            title={series.title}
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
          />
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {next ? <CalendarButtons event={next} /> : null}
        {next ? (
          <Link
            href={`/event/${next.slug}`}
            className="rounded-full border border-line px-4 py-2 text-sm text-paper hover:border-amber/50 hover:text-amber"
          >
            This year&apos;s page
          </Link>
        ) : null}
        <ShareButton title={`Days until ${series.title}`} path={path} />
      </div>

      {/* The embed follows the series, not one occurrence: a widget put up for Christmas 2026
          keeps ticking to Christmas 2027 the day after, without the owner touching the snippet. */}
      {series.nextDate && !isCoarsePrecision(series.nextPrecision) ? (
        <EmbedStudio slug={series.slug} title={series.title} origin={siteUrl()} />
      ) : null}

      <section className="mt-14">
        <h2 className="font-serif text-2xl text-paper">Upcoming dates</h2>
        <p className="mt-1 text-sm text-muted">
          Every {series.title} in the catalog from today on, soonest first.
        </p>
        <EventTable events={occurrences} showCategory={false} emptyText="No future dates yet — check back after the next refresh." />
      </section>

      {variants.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-serif text-xl text-paper">Other dates linked to this series</h2>
          <p className="mt-1 text-sm text-muted">
            Observed under the same name on a different day in a few countries — listed apart so the countdown above
            stays on the main date.
          </p>
          <EventTable events={variants.slice(0, VARIANT_LIMIT)} showCategory={false} />
        </section>
      ) : null}

      {series.faq.length > 0 ? (
        <section className="mt-14 max-w-2xl">
          <h2 className="font-serif text-2xl text-paper">Questions people ask</h2>
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
          Tags:
          {series.tags.map((tag) => (
            <Link key={tag} href={`/tag/${encodeURIComponent(tag)}`} className="rounded-full border border-line px-2 py-0.5 text-xs text-paper-dim hover:text-paper">
              {tag}
            </Link>
          ))}
        </p>
      ) : null}

      {related.length > 0 ? (
        <section className="mt-14">
          <h2 className="font-serif text-2xl text-paper">More {CATEGORY_LABELS[series.category].toLowerCase()} that come back every year</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((s) => (
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
          <p className="mt-4 text-sm">
            <Link href="/days-until" className="text-amber underline hover:text-paper">
              All recurring countdowns
            </Link>
          </p>
        </section>
      ) : null}

      <JsonLd data={eventSeries(series, occurrences)} />
    </article>
  );
}
