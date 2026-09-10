import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { countryCounts } from "@/lib/catalog";
import { collectionPage } from "@/lib/jsonld";
import { COUNTRY_NAMES } from "@/lib/regions";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Countries — upcoming holidays and events by country",
  description:
    "Public holidays, national days and local events for more than 200 countries and territories, each with live countdowns and calendar links.",
  canonical: "/country",
  ogPath: "/og/default",
});

export default async function CountryIndexPage() {
  const counts = await countryCounts();
  const rows = Object.entries(counts)
    .filter(([code, n]) => n > 0 && COUNTRY_NAMES[code])
    .map(([code, n]) => ({ code, n, name: COUNTRY_NAMES[code] }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  return (
    <div>
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Countries", path: "/country" }]} />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">Browse</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">By country</h1>
      <p className="mt-4 max-w-2xl text-paper-dim">
        {rows.length} countries and territories with upcoming holidays and events in the catalog.
      </p>
      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-muted">The catalog is being filled — check back soon.</p>
      ) : (
        <ul className="mt-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((r) => (
            <li key={r.code} className="flex items-baseline justify-between gap-3 border-b border-line/60 py-2">
              <Link href={`/country/${r.code.toLowerCase()}`} className="text-paper hover:text-amber">
                {r.name}
              </Link>
              <span className="tabular font-mono text-xs text-muted">{r.n.toLocaleString("en-US")}</span>
            </li>
          ))}
        </ul>
      )}
      <JsonLd
        data={collectionPage(
          "Countries",
          "Upcoming holidays and events by country.",
          "/country",
          rows.slice(0, 100).map((r) => ({ name: r.name, path: `/country/${r.code.toLowerCase()}` })),
        )}
      />
    </div>
  );
}
