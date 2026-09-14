import { prerenderLimit } from "@/lib/prerender";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventCard } from "@/components/EventCard";
import { EventTable } from "@/components/EventTable";
import { JsonLd } from "@/components/JsonLd";
import { countryCounts, countryEvents, worldwideUpcoming } from "@/lib/catalog";
import { collectionPage } from "@/lib/jsonld";
import { COUNTRY_NAMES } from "@/lib/regions";
import {
  buildMetadata,
  countryTitle,
  monthLabel,
  pad2,
  yearMonthOf,
} from "@/lib/seo";
import { catalogDay } from "@/lib/time";
import type { CountdownEvent } from "@/lib/types";

export const revalidate = 3600;

const PRERENDER_COUNTRIES = 40;
const EVENT_LIMIT = 250;

type Props = { params: Promise<{ code: string }> };

function countryOf(code: string): { cc: string; name: string } | null {
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  const name = COUNTRY_NAMES[cc];
  return name ? { cc, name } : null;
}

/** Optionally warm popular countries; default is on-demand ISR. */
export async function generateStaticParams() {
  const limit = prerenderLimit(PRERENDER_COUNTRIES);
  if (!limit) return [];
  const counts = await countryCounts();
  return Object.entries(counts)
    .filter(([code, n]) => n > 0 && /^[A-Z]{2}$/.test(code) && COUNTRY_NAMES[code])
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([code]) => ({ code: code.toLowerCase() }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const country = code === code.toLowerCase() ? countryOf(code) : null;
  if (!country)
    return { title: "Country", robots: { index: false, follow: true } };
  const counts = await countryCounts();
  const n = counts[country.cc] ?? 0;
  return buildMetadata({
    title: countryTitle(country.name),
    description: `Public holidays, national days and events in ${country.name}${n > 0 ? ` — ${n.toLocaleString("en-US")} upcoming dates` : ""}, grouped by month, each with a live countdown and calendar links.`,
    canonical: `/country/${country.cc.toLowerCase()}`,
    ogPath: `/og/country/${country.cc.toLowerCase()}`,
    noindex: n === 0,
  });
}

export default async function CountryPage({ params }: Props) {
  const { code } = await params;
  // Only the lowercase form exists (same rule as event/series slugs). A redirect from inside an
  // ISR render is stored under the request's key, and on a case-insensitive file system (macOS
  // `next start`) that entry shadows the canonical path for the whole revalidate window.
  if (code !== code.toLowerCase()) notFound();
  const country = countryOf(code);
  if (!country) notFound();
  const path = `/country/${country.cc.toLowerCase()}`;

  const [events, worldwide] = await Promise.all([
    countryEvents(country.cc, EVENT_LIMIT),
    worldwideUpcoming(6),
  ]);

  const byMonth = new Map<string, CountdownEvent[]>();
  for (const event of events) {
    const key = catalogDay(event.date, event.timezone).slice(0, 7);
    const bucket = byMonth.get(key) ?? [];
    bucket.push(event);
    byMonth.set(key, bucket);
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Countries", path: "/country" },
          { name: country.name, path },
        ]}
      />
      <p className="eyebrow mt-7">
        Country
      </p>
      <h1 className="page-heading mt-3 flex items-center gap-4">
        <span className="hidden h-16 w-20 shrink-0 items-center justify-center rounded-2xl border border-line bg-ink-2 text-2xl tracking-normal text-amber sm:flex" aria-hidden="true">{country.cc}</span>
        {country.name}
      </h1>
      <p className="page-subtitle mt-3 max-w-2xl">
        Upcoming holidays and events tagged {country.name}, month by month.
        Worldwide dates — eclipses, releases, international days — are listed
        separately below.
      </p>

      {byMonth.size > 0 ? <nav className="mt-7 flex gap-2 overflow-x-auto p-1 pb-3" aria-label={`Jump to a month in ${country.name}`}>
        {Array.from(byMonth.entries()).map(([key, list]) => {
          const { year, month } = yearMonthOf(`${key}-01`);
          return <a key={key} href={`#month-${key}`} className="button-secondary shrink-0">{monthLabel(year, month)}<span className="text-muted">{list.length}</span></a>;
        })}
      </nav> : null}
      <p className="tabular mt-2 text-sm text-muted">
        {events.length.toLocaleString("en-US")}
        {events.length >= EVENT_LIMIT ? "+" : ""} upcoming{" "}
        {events.length === 1 ? "date" : "dates"}.
      </p>

      {byMonth.size === 0 ? (
        <p className="empty-state mt-10 text-paper-dim">
          No dates tagged {country.name} yet.
        </p>
      ) : (
        Array.from(byMonth.entries()).map(([key, list]) => {
          const { year, month } = yearMonthOf(`${key}-01`);
          return (
            <section key={key} id={`month-${key}`} className="mt-10 scroll-mt-28">
              <h2 className="section-heading text-paper">
                <Link
                  href={`/calendar/${year}/${pad2(month)}`}
                  className="hover:text-amber"
                >
                  {monthLabel(year, month)}
                </Link>
              </h2>
              <EventTable events={list} />
            </section>
          );
        })
      )}

      {worldwide.length > 0 ? (
        <section className="mt-14">
          <h2 className="section-heading text-paper">
            Worldwide, coming up
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {worldwide.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ) : null}

      <JsonLd
        data={collectionPage(
          `${country.name}: upcoming holidays and events`,
          `Holidays and events in ${country.name}.`,
          path,
          events
            .slice(0, 100)
            .map((e) => ({ name: e.title, path: `/event/${e.slug}` })),
        )}
      />
    </div>
  );
}
