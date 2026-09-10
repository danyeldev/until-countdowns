import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventCard } from "@/components/EventCard";
import { EventTable } from "@/components/EventTable";
import { JsonLd } from "@/components/JsonLd";
import { countryCounts, countryEvents, worldwideUpcoming } from "@/lib/catalog";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { i18n, localePage } from "@/lib/i18n/server";
import { collectionPage } from "@/lib/jsonld";
import { COUNTRY_NAMES } from "@/lib/regions";
import { buildMetadata, countryTitle, displayTitle, pad2, yearMonthOf } from "@/lib/seo";
import type { CountdownEvent } from "@/lib/types";

export const revalidate = 3600;

/** How many countries are prerendered, in English and in everything else (each entry × 15 locales). */
const PRERENDER_COUNTRIES = { en: 40, other: 12 };
const EVENT_LIMIT = 250;

type Props = { params: Promise<{ locale: string; code: string }> };

/**
 * The code, if it is one the catalog has a country for. `fallback` is the English name, which is
 * only ever used for the handful of codes `Intl.DisplayNames` declines to name.
 */
function countryOf(code: string): { cc: string; fallback: string } | null {
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  const fallback = COUNTRY_NAMES[cc];
  return fallback ? { cc, fallback } : null;
}

/** The countries with the most upcoming events are prerendered; the rest render on first visit. */
export async function generateStaticParams() {
  const locale = await localeParam();
  const counts = await countryCounts();
  return Object.entries(counts)
    .filter(([code, n]) => n > 0 && COUNTRY_NAMES[code])
    .sort((a, b) => b[1] - a[1])
    .slice(0, locale === DEFAULT_LOCALE ? PRERENDER_COUNTRIES.en : PRERENDER_COUNTRIES.other)
    .map(([code]) => ({ code: code.toLowerCase() }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const L = await i18n();
  const { code } = await params;
  const country = code === code.toLowerCase() ? countryOf(code) : null;
  if (!country) return { title: L.m.hubs.label.country, robots: { index: false, follow: true } };
  const counts = await countryCounts();
  const n = counts[country.cc] ?? 0;
  const name = L.fmt.countryName(country.cc, country.fallback);
  return buildMetadata({
    locale: L.locale,
    title: countryTitle(L, name),
    description:
      n > 0
        ? L.tn(L.m.hubs.country.description, n, { country: name })
        : L.t(L.m.hubs.country.descriptionEmpty, { country: name }),
    canonical: `/country/${country.cc.toLowerCase()}`,
    ogPath: `/og/country/${country.cc.toLowerCase()}`,
  });
}

export default async function CountryPage({ params }: Props) {
  const L = await localePage();
  const { code } = await params;
  // Only the lowercase form exists (same rule as event/series slugs). A redirect from inside an
  // ISR render is stored under the request's key, and on a case-insensitive file system (macOS
  // `next start`) that entry shadows the canonical path for the whole revalidate window.
  if (code !== code.toLowerCase()) notFound();
  const country = countryOf(code);
  if (!country) notFound();
  const path = `/country/${country.cc.toLowerCase()}`;
  // "España" · "スペイン": ICU names the country, so no country list needs translating.
  const name = L.fmt.countryName(country.cc, country.fallback);

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
      <Breadcrumbs
        items={[
          { name: L.m.common.breadcrumb.home, path: "/" },
          { name: L.m.common.nav.countries, path: "/country" },
          { name, path },
        ]}
      />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">{L.m.hubs.label.country}</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">{name}</h1>
      <p className="mt-4 max-w-2xl text-paper-dim">{L.t(L.m.hubs.country.intro, { country: name })}</p>
      <p className="tabular mt-2 text-sm text-muted">
        {events.length >= EVENT_LIMIT
          ? L.tn(L.m.hubs.country.countCapped, events.length)
          : L.tn(L.m.hubs.country.count, events.length)}
      </p>

      {byMonth.size === 0 ? (
        <p className="mt-10 text-sm text-muted">{L.t(L.m.hubs.country.empty, { country: name })}</p>
      ) : (
        Array.from(byMonth.entries()).map(([key, list]) => {
          const { year, month } = yearMonthOf(`${key}-01`);
          return (
            <section key={key} className="mt-10">
              <h2 className="font-serif text-2xl text-paper">
                <Link href={L.href(`/calendar/${year}/${pad2(month)}`)} className="hover:text-amber">
                  {L.fmt.monthYear(year, month)}
                </Link>
              </h2>
              <EventTable events={list} />
            </section>
          );
        })
      )}

      {worldwide.length > 0 ? (
        <section className="mt-14">
          <h2 className="font-serif text-2xl text-paper">{L.m.hubs.country.worldwide}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {worldwide.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ) : null}

      <JsonLd
        data={collectionPage(
          L,
          countryTitle(L, name),
          L.t(L.m.hubs.country.collectionDescription, { country: name }),
          path,
          events.slice(0, 100).map((e) => ({ name: displayTitle(L, e), path: `/event/${e.slug}` })),
        )}
      />
    </div>
  );
}
