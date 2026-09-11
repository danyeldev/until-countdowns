import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventTable } from "@/components/EventTable";
import { JsonLd } from "@/components/JsonLd";
import { eventsInMonth } from "@/lib/catalog";
import { i18n, localePage } from "@/lib/i18n/server";
import { collectionPage } from "@/lib/jsonld";
import {
  buildMetadata,
  CALENDAR_MAX_YEAR,
  CALENDAR_MIN_YEAR,
  displayTitle,
  monthTitle,
  nextMonth,
  pad2,
  prevMonth,
  todayUtc,
  yearMonthOf,
} from "@/lib/seo";
import { catalogDay } from "@/lib/time";
import type { CountdownEvent } from "@/lib/types";

export const revalidate = 3600;

const PRERENDER_MONTHS = 24;

type Props = { params: Promise<{ locale: string; year: string; month: string }> };

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
  const L = await i18n();
  const ym = parseMonth(await params);
  if (!ym) return { title: L.m.hubs.label.calendar, robots: { index: false, follow: true } };
  if (isPastMonth(ym.year, ym.month)) {
    return { title: monthTitle(L, ym.year, ym.month), robots: { index: false, follow: true } };
  }
  return buildMetadata({
    locale: L.locale,
    title: monthTitle(L, ym.year, ym.month),
    description: L.t(L.m.hubs.calendar.description, { month: L.fmt.monthYear(ym.year, ym.month) }),
    canonical: `/calendar/${ym.year}/${pad2(ym.month)}`,
    ogPath: `/og/month/${ym.year}/${pad2(ym.month)}`,
  });
}

export default async function CalendarMonthPage({ params }: Props) {
  const L = await localePage();
  const raw = await params;
  const ym = parseMonth(raw);
  if (!ym) notFound();
  if (raw.month !== pad2(ym.month)) permanentRedirect(L.href(`/calendar/${ym.year}/${pad2(ym.month)}`));
  if (isPastMonth(ym.year, ym.month)) notFound();
  const path = `/calendar/${ym.year}/${pad2(ym.month)}`;
  const label = L.fmt.monthYear(ym.year, ym.month);

  // `eventsInMonth()` selects and orders on `starts_on`, the day in the event's own zone, so the
  // buckets have to be keyed the same way. Keying on the UTC prefix filed a 20:00 New York premiere
  // under tomorrow's heading while the table row beneath it printed today's date.
  const events = await eventsInMonth(ym.year, ym.month);
  const byDay = new Map<string, CountdownEvent[]>();
  for (const event of events) {
    const key = catalogDay(event.date, event.timezone);
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
      <Breadcrumbs
        items={[
          { name: L.m.common.breadcrumb.home, path: "/" },
          // A year is a number nobody groups, so it is not run through the number formatter.
          { name: String(ym.year), path: `/calendar/${ym.year}/01` },
          { name: label, path },
        ]}
      />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">{L.m.hubs.label.calendar}</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">{label}</h1>
      <p className="tabular mt-4 max-w-2xl text-paper-dim">
        {events.length === 0
          ? L.t(L.m.hubs.calendar.empty, { month: label })
          : L.tn(L.m.hubs.calendar.count, events.length, { month: label })}
      </p>
      <nav className="mt-6 flex gap-4 text-sm" aria-label={L.m.hubs.calendar.months}>
        {canPrev ? (
          <Link href={L.href(`/calendar/${prev.year}/${pad2(prev.month)}`)} rel="prev" className="text-paper-dim hover:text-paper">
            {L.t(L.m.hubs.calendar.previous, { month: L.fmt.monthYear(prev.year, prev.month) })}
          </Link>
        ) : null}
        {canNext ? (
          <Link href={L.href(`/calendar/${next.year}/${pad2(next.month)}`)} rel="next" className="ms-auto text-paper-dim hover:text-paper">
            {L.t(L.m.hubs.calendar.next, { month: L.fmt.monthYear(next.year, next.month) })}
          </Link>
        ) : null}
      </nav>

      {Array.from(byDay.entries()).map(([day, list]) => (
        <section key={day} className="mt-10">
          <h2 className="font-serif text-xl text-paper">
            <time dateTime={day}>{L.fmt.longDate(day)}</time>
          </h2>
          <EventTable events={list} />
        </section>
      ))}

      <JsonLd
        data={collectionPage(
          L,
          monthTitle(L, ym.year, ym.month),
          L.t(L.m.hubs.calendar.collectionDescription, { month: label }),
          path,
          events.slice(0, 100).map((e) => ({ name: displayTitle(L, e), path: `/event/${e.slug}` })),
        )}
      />
    </div>
  );
}
