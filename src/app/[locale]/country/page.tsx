import { Link } from "@/i18n/navigation";
import { CountryDirectory } from "@/components/CountryDirectory";
import { Icon } from "@/components/Icon";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { countryCounts } from "@/lib/catalog";
import { collectionPage } from "@/lib/jsonld";
import { COUNTRY_NAMES } from "@/lib/regions";
import { localizedMetadata } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata() {
  return localizedMetadata({
  title: "Countries — upcoming holidays and events by country",
  description:
    "Public holidays, national days and local events for more than 200 countries and territories, each with live countdowns and calendar links.",
  canonical: "/country",
  ogPath: "/og/default",
});
}

export default async function CountryIndexPage() {
  const counts = await countryCounts();
  const rows = Object.entries(counts)
    .filter(([code, n]) => n > 0 && /^[A-Z]{2}$/.test(code) && COUNTRY_NAMES[code])
    .map(([code, n]) => ({ code, n, name: COUNTRY_NAMES[code] }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  return (
    <div>
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Countries", path: "/country" }]} />
      <p className="eyebrow mt-7">Browse</p>
      <h1 className="page-heading mt-3">By country</h1>
      <p className="page-subtitle mt-3 max-w-2xl">
        {rows.length} countries and territories with upcoming holidays and events in the catalog.
      </p>
      <Link href="/" className="group mt-6 inline-flex items-center gap-3 text-sm text-paper-dim hover:text-paper">
        <span className="flex size-9 items-center justify-center rounded-full bg-surface text-amber"><Icon name="globe" size={17} /></span>
        <span>Looking beyond borders? Explore worldwide launches, releases and moments.</span>
        <Icon name="arrow" size={15} className="shrink-0 text-muted group-hover:text-amber" />
      </Link>
      <CountryDirectory countries={rows} />
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
