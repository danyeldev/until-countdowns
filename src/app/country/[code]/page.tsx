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
import { buildMetadata, countryTitle, monthLabel, pad2, yearMonthOf } from "@/lib/seo";
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

/** The 40 countries with the most upcoming events are prerendered; the rest render on first visit. */
export async function generateStaticParams() {
  const counts = await countryCounts();
  return Object.entries(counts)
    .filter(([code, n]) => n > 0 && COUNTRY_NAMES[code])
    .sort((a, b) => b[1] - a[1])
    .slice(0, PRERENDER_COUNTRIES)
    .map(([code]) => ({ code: code.toLowerCase() }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const country = code === code.toLowerCase() ? countryOf(code) : null;
  if (!country) return { title: "Country", robots: { index: false, follow: true } };
  const counts = await countryCounts();
  const n = counts[country.cc] ?? 0;
  return buildMetadata({
    title: countryTitle(country.name),
    description: `Public holidays, national days and events in ${country.name}${n > 0 ? ` — ${n.toLocaleString("en-US")} upcoming dates` : ""}, grouped by month, each with a live countdown and calendar links.`,
    canonical: `/country/${country.cc.toLowerCase()}`,
    ogPath: `/og/country/${country.cc.toLowerCase()}`,
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

  const [events, worldwide] = await Promise.all([countryEvents(country.cc, EVENT_LIMIT), worldwideUpcoming(6)]);

  const byMonth = new Map<string, CountdownEvent[]>();
  for (const event of events) {
    const key = event.date.slice(0, 7);
    const bucket = byMonth.get(key) ?? [];
    bucket.push(event);
    byMonth.set(key, bucket);
  }

  return (
    <div>
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Countries", path: "/country" }, { name: country.name, path }]} />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">Country</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">{country.name}</h1>
      <p className="mt-4 max-w-2xl text-paper-dim">
        Upcoming holidays and events tagged {country.name}, month by month. Worldwide dates — eclipses, releases,
        international days — are listed separately below.
      </p>
      <p className="tabular mt-2 text-sm text-muted">
        {events.length.toLocaleString("en-US")}
        {events.length >= EVENT_LIMIT ? "+" : ""} upcoming {events.length === 1 ? "date" : "dates"}.
      </p>

      {byMonth.size === 0 ? (
        <p className="mt-10 text-sm text-muted">No dates tagged {country.name} yet.</p>
      ) : (
        Array.from(byMonth.entries()).map(([key, list]) => {
          const { year, month } = yearMonthOf(`${key}-01`);
          return (
            <section key={key} className="mt-10">
              <h2 className="font-serif text-2xl text-paper">
                <Link href={`/calendar/${year}/${pad2(month)}`} className="hover:text-amber">
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
          <h2 className="font-serif text-2xl text-paper">Worldwide, coming up</h2>
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
          events.slice(0, 100).map((e) => ({ name: e.title, path: `/event/${e.slug}` })),
        )}
      />
    </div>
  );
}
