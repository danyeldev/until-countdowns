import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { countryCounts } from "@/lib/catalog";
import { i18n, localePage } from "@/lib/i18n/server";
import { collectionPage } from "@/lib/jsonld";
import { COUNTRY_NAMES } from "@/lib/regions";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const L = await i18n();
  return buildMetadata({
    locale: L.locale,
    title: L.m.hubs.countryIndex.title,
    description: L.m.hubs.countryIndex.description,
    canonical: "/country",
    ogPath: "/og/default",
  });
}

export default async function CountryIndexPage() {
  const L = await localePage();
  const counts = await countryCounts();
  // `COUNTRY_NAMES` decides whether a code is one we know at all, and is the fallback for the few
  // ICU declines to name; the name a reader sees comes from ICU, and so does the sort order.
  const rows = Object.entries(counts)
    .filter(([code, n]) => n > 0 && COUNTRY_NAMES[code])
    .map(([code, n]) => ({ code, n, name: L.fmt.countryName(code, COUNTRY_NAMES[code]) }))
    .sort((a, b) => a.name.localeCompare(b.name, L.tag));

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: L.m.common.breadcrumb.home, path: "/" },
          { name: L.m.common.nav.countries, path: "/country" },
        ]}
      />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">{L.m.hubs.label.browse}</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">{L.m.hubs.countryIndex.heading}</h1>
      <p className="mt-4 max-w-2xl text-paper-dim">{L.tn(L.m.hubs.countryIndex.intro, rows.length)}</p>
      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-muted">{L.m.hubs.countryIndex.empty}</p>
      ) : (
        <ul className="mt-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((r) => (
            <li key={r.code} className="flex items-baseline justify-between gap-3 border-b border-line/60 py-2">
              <Link href={L.href(`/country/${r.code.toLowerCase()}`)} className="text-paper hover:text-amber">
                {r.name}
              </Link>
              <span className="tabular font-mono text-xs text-muted">{L.fmt.number(r.n)}</span>
            </li>
          ))}
        </ul>
      )}
      <JsonLd
        data={collectionPage(
          L,
          L.m.common.nav.countries,
          L.m.hubs.countryIndex.collectionDescription,
          "/country",
          rows.slice(0, 100).map((r) => ({ name: r.name, path: `/country/${r.code.toLowerCase()}` })),
        )}
      />
    </div>
  );
}
