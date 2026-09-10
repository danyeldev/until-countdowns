import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventTable } from "@/components/EventTable";
import { JsonLd } from "@/components/JsonLd";
import { eventsInMonth } from "@/lib/catalog";
import { collectionPage } from "@/lib/jsonld";
import {
  buildMetadata,
  CALENDAR_MAX_YEAR,
  CALENDAR_MIN_YEAR,
  formatLongDate,
  monthLabel,
  monthTitle,
  nextMonth,
  pad2,
  prevMonth,
  todayUtc,
  yearMonthOf,
} from "@/lib/seo";
import type { CountdownEvent } from "@/lib/types";

export const revalidate = 3600;

const PRERENDER_MONTHS = 24;

type Props = { params: Promise<{ year: string; month: string }> };

function parseMonth(params: { year: string; month: string }): { year: number; month: number } | null {
  if (!/^\d{4}$/.test(params.year) || !/^\d{1,2}$/.test(params.month)) return null;
  const year = Number(params.year);
  const month = Number(params.month);
  if (year < CALENDAR_MIN_YEAR || year > CALENDAR_MAX_YEAR || month < 1 || month > 12) return null;
  return { year, month };
}

/**
 * Months before the current UTC month have nothing upcoming and would be indexable thin pages
 * reachable through the prev-month links; they 404 (and the current month has no prev link).
 * An ISR entry re-evaluates this on its hourly revalidate, so a month expires by itself.
 */
function isPastMonth(year: number, month: number): boolean {
  const now = yearMonthOf(todayUtc());
  return year < now.year || (year === now.year && month < now.month);
}

/** The next 24 months are prerendered; other months in the 2026–2040 window render on first visit. */
export function generateStaticParams() {
  let { year, month } = yearMonthOf(todayUtc());
  const out: { year: string; month: string }[] = [];
  for (let i = 0; i < PRERENDER_MONTHS && year <= CALENDAR_MAX_YEAR; i++) {
    out.push({ year: String(year), month: pad2(month) });
    ({ year, month } = nextMonth(year, month));
  }
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ym = parseMonth(await params);
  if (!ym) return { title: "Calendar", robots: { index: false, follow: true } };
  if (isPastMonth(ym.year, ym.month)) return { title: monthTitle(ym.year, ym.month), robots: { index: false, follow: true } };
  return buildMetadata({
    title: monthTitle(ym.year, ym.month),
    description: `Everything in the catalog for ${monthLabel(ym.year, ym.month)}: holidays, launches, finals, premieres and anniversaries, day by day, with live countdowns.`,
    canonical: `/calendar/${ym.year}/${pad2(ym.month)}`,
    ogPath: `/og/month/${ym.year}/${pad2(ym.month)}`,
  });
}

export default async function CalendarMonthPage({ params }: Props) {
  const raw = await params;
  const ym = parseMonth(raw);
  if (!ym) notFound();
  if (raw.month !== pad2(ym.month)) permanentRedirect(`/calendar/${ym.year}/${pad2(ym.month)}`);
  if (isPastMonth(ym.year, ym.month)) notFound();
  const path = `/calendar/${ym.year}/${pad2(ym.month)}`;
  const label = monthLabel(ym.year, ym.month);

  const events = await eventsInMonth(ym.year, ym.month);
  const byDay = new Map<string, CountdownEvent[]>();
  for (const event of events) {
    const key = event.date.slice(0, 10);
    const bucket = byDay.get(key) ?? [];
    bucket.push(event);
    byDay.set(key, bucket);
  }

  const prev = prevMonth(ym.year, ym.month);
  const next = nextMonth(ym.year, ym.month);
  const canPrev = prev.year >= CALENDAR_MIN_YEAR && !isPastMonth(prev.year, prev.month);
  const canNext = next.year <= CALENDAR_MAX_YEAR;

  return (
    <div>
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: String(ym.year), path: `/calendar/${ym.year}/01` }, { name: label, path }]} />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">Calendar</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">{label}</h1>
      <p className="tabular mt-4 max-w-2xl text-paper-dim">
        {events.length === 0
          ? `Nothing upcoming in ${label} yet.`
          : `${events.length.toLocaleString("en-US")} upcoming ${events.length === 1 ? "date" : "dates"} in ${label}, day by day.`}
      </p>
      <nav className="mt-6 flex gap-4 text-sm" aria-label="Months">
        {canPrev ? (
          <Link href={`/calendar/${prev.year}/${pad2(prev.month)}`} rel="prev" className="text-paper-dim hover:text-paper">
            ← {monthLabel(prev.year, prev.month)}
          </Link>
        ) : null}
        {canNext ? (
          <Link href={`/calendar/${next.year}/${pad2(next.month)}`} rel="next" className="ml-auto text-paper-dim hover:text-paper">
            {monthLabel(next.year, next.month)} →
          </Link>
        ) : null}
      </nav>

      {Array.from(byDay.entries()).map(([day, list]) => (
        <section key={day} className="mt-10">
          <h2 className="font-serif text-xl text-paper">
            <time dateTime={day}>{formatLongDate(day)}</time>
          </h2>
          <EventTable events={list} />
        </section>
      ))}

      <JsonLd
        data={collectionPage(
          monthTitle(ym.year, ym.month),
          `Upcoming dates in ${label}.`,
          path,
          events.slice(0, 100).map((e) => ({ name: e.title, path: `/event/${e.slug}` })),
        )}
      />
    </div>
  );
}
