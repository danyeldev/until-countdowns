import { englishParams } from "@/i18n/params";
import { prerenderLimit } from "@/lib/prerender";
import type { Metadata } from "next";
import { catalogDay } from "@/lib/time";
import { Link } from "@/i18n/navigation";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventTable } from "@/components/EventTable";
import { JsonLd } from "@/components/JsonLd";
import { Icon } from "@/components/Icon";
import { eventsInMonth } from "@/lib/catalog";
import { collectionPage } from "@/lib/jsonld";
import {
  CALENDAR_MAX_YEAR,
  CALENDAR_MIN_YEAR,
  formatLongDate,
  monthLabel,
  monthTitle,
  nextMonth,
  pad2,
  prevMonth,
  todayUtc,
  yearMonthOf, localizedMetadata } from "@/lib/seo";
import type { CountdownEvent } from "@/lib/types";

export const revalidate = 3600;

const PRERENDER_MONTHS = 24;

type Props = { params: Promise<{ year: string; month: string }> };

function parseMonth(params: {
  year: string;
  month: string;
}): { year: number; month: number } | null {
  if (!/^\d{4}$/.test(params.year) || !/^\d{1,2}$/.test(params.month))
    return null;
  const year = Number(params.year);
  const month = Number(params.month);
  if (
    year < CALENDAR_MIN_YEAR ||
    year > CALENDAR_MAX_YEAR ||
    month < 1 ||
    month > 12
  )
    return null;
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

/** Optionally warm future months; default is on-demand ISR. */
export function generateStaticParams() {
  let { year, month } = yearMonthOf(todayUtc());
  const out: { year: string; month: string }[] = [];
  for (
    let i = 0;
    i < prerenderLimit(PRERENDER_MONTHS) && year <= CALENDAR_MAX_YEAR;
    i++
  ) {
    out.push({ year: String(year), month: pad2(month) });
    ({ year, month } = nextMonth(year, month));
  }
  return englishParams(out);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ym = parseMonth(await params);
  if (!ym) return { title: "Calendar", robots: { index: false, follow: true } };
  if (isPastMonth(ym.year, ym.month))
    return {
      title: monthTitle(ym.year, ym.month),
      robots: { index: false, follow: true },
    };
  return localizedMetadata({
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
  if (raw.month !== pad2(ym.month))
    permanentRedirect(`/calendar/${ym.year}/${pad2(ym.month)}`);
  if (isPastMonth(ym.year, ym.month)) notFound();
  const path = `/calendar/${ym.year}/${pad2(ym.month)}`;
  const label = monthLabel(ym.year, ym.month);

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
  const canPrev =
    prev.year >= CALENDAR_MIN_YEAR && !isPastMonth(prev.year, prev.month);
  const canNext = next.year <= CALENDAR_MAX_YEAR;
  const today = todayUtc();
  const firstWeekday = (new Date(Date.UTC(ym.year, ym.month - 1, 1)).getUTCDay() + 6) % 7;
  const dayCount = new Date(Date.UTC(ym.year, ym.month, 0)).getUTCDate();
  const weekCount = Math.ceil((firstWeekday + dayCount) / 7);

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Calendar", path: "/calendar" },
          { name: label, path },
        ]}
      />
      <p className="eyebrow mt-7">
        Calendar
      </p>
      <h1 className="page-heading mt-3">
        {label}
      </h1>
      <p className="page-subtitle tabular mt-3 max-w-2xl">
        {events.length === 0
          ? `Nothing upcoming in ${label} yet.`
          : `${events.length.toLocaleString("en-US")} upcoming ${events.length === 1 ? "date" : "dates"} in ${label}, day by day.`}
      </p>
      <nav className="mt-7 flex flex-wrap items-center gap-2" aria-label="Month navigation">
        {canPrev ? (
          <Link
            href={`/calendar/${prev.year}/${pad2(prev.month)}`}
            rel="prev"
            className="button-secondary"
          >
            <Icon name="arrowLeft" /> {monthLabel(prev.year, prev.month)}
          </Link>
        ) : null}
        <Link href="/calendar" className="button-secondary">This month</Link>
        {canNext ? (
          <Link
            href={`/calendar/${next.year}/${pad2(next.month)}`}
            rel="next"
            className="button-secondary ml-auto"
          >
            {monthLabel(next.year, next.month)} <Icon name="arrow" />
          </Link>
        ) : null}
      </nav>

      <section className="mt-8" aria-label={`${label} overview`}>
        <nav className="grid grid-cols-6 gap-1 sm:grid-cols-12" aria-label={`Months in ${ym.year}`}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
            const name = new Date(Date.UTC(ym.year, month - 1, 1)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
            return isPastMonth(ym.year, month) ? (
              <span key={month} className="flex min-h-11 items-center justify-center text-sm text-muted/60">{name}</span>
            ) : (
              <Link key={month} href={`/calendar/${ym.year}/${pad2(month)}`} aria-current={month === ym.month ? "page" : undefined} className={`flex min-h-10 items-center justify-center rounded-lg text-sm transition-colors ${month === ym.month ? "bg-paper font-medium text-ink" : "text-paper-dim hover:bg-surface hover:text-paper"}`}>
                {name}
              </Link>
            );
          })}
        </nav>
        <table className="mt-6 w-full table-fixed border-separate border-spacing-0.5 text-center sm:border-spacing-1">
          <caption className="sr-only">{label}. Select a date to see its upcoming events.</caption>
          <thead>
            <tr>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <th key={day} scope="col" className="pb-2 text-xs font-medium text-muted">{day}</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: weekCount }, (_, week) => (
              <tr key={week}>
                {Array.from({ length: 7 }, (_, weekday) => {
                  const day = week * 7 + weekday - firstWeekday + 1;
                  if (day < 1 || day > dayCount) return <td key={weekday} />;
                  const date = `${ym.year}-${pad2(ym.month)}-${pad2(day)}`;
                  const n = byDay.get(date)?.length ?? 0;
                  const isToday = date === today;
                  const content = <><span className={`text-sm font-semibold sm:text-lg ${isToday ? "text-amber" : ""}`}>{day}</span><span className="mt-1 flex h-4 items-center justify-center text-[10px] text-muted sm:text-xs">{n > 0 ? <><span className="h-1 w-1 rounded-full bg-amber sm:hidden" /><span className="hidden sm:inline">{n} {n === 1 ? "date" : "dates"}</span></> : null}</span></>;
                  return <td key={weekday} className="p-0">
                    {n > 0 ? (
                      <a href={`#day-${date}`} aria-label={`${formatLongDate(date)}, ${n} upcoming ${n === 1 ? "event" : "events"}${isToday ? ", today" : ""}`} aria-current={isToday ? "date" : undefined} className={`flex min-h-14 flex-col items-center justify-center rounded-xl transition-colors hover:bg-surface-hover sm:min-h-20 ${isToday ? "bg-amber/15" : "bg-surface"}`}>{content}</a>
                    ) : (
                      <span aria-label={isToday ? `${formatLongDate(date)}, today, no upcoming events` : undefined} className={`flex min-h-14 flex-col items-center justify-center rounded-xl sm:min-h-20 ${date < today ? "text-muted/50" : "text-muted"} ${isToday ? "bg-amber/15" : ""}`}>{content}</span>
                    )}
                  </td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">Select a highlighted day to explore its dates.</p>
      </section>

      {events.length === 0 ? <div className="empty-state mt-8"><Icon name="calendar" size={28} /><h2 className="section-heading mt-4">Room for something good</h2><p className="mt-2 text-paper-dim">Dates will appear here as they are announced.</p><Link href="/category" className="button-primary mt-5">Explore categories <Icon name="arrow" /></Link></div> : null}

      {Array.from(byDay.entries()).map(([day, list]) => (
        <section key={day} id={`day-${day}`} className="mt-14 scroll-mt-28">
          <h2 className="section-heading flex flex-wrap items-baseline gap-3">
            <time dateTime={day}>{formatLongDate(day)}</time>
            <span className="text-sm font-normal text-muted">{list.length} {list.length === 1 ? "date" : "dates"}</span>
          </h2>
          <EventTable events={list} />
        </section>
      ))}

      <JsonLd
        data={collectionPage(
          monthTitle(ym.year, ym.month),
          `Upcoming dates in ${label}.`,
          path,
          events
            .slice(0, 100)
            .map((e) => ({ name: e.title, path: `/event/${e.slug}` })),
        )}
      />
    </div>
  );
}
