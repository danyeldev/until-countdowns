import { Link } from "@/i18n/navigation";
import { CountryDirectory } from "@/components/CountryDirectory";
import { Icon } from "@/components/Icon";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { countryCounts } from "@/lib/catalog";
import { collectionPage } from "@/lib/jsonld";
import { COUNTRY_NAMES } from "@/lib/regions";
import { localizedMetadata } from "@/lib/seo";
import { activateLocale } from "@/i18n/request-locale";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  activateLocale(locale);
  return localizedMetadata({
  title: "Countries — upcoming holidays and events by country",
  description:
    "Public holidays, national days and local events for more than 200 countries and territories, each with live countdowns and calendar links.",
  canonical: "/country",
  ogPath: "/og/default",
    locale,
  });
}

export default async function CountryIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  activateLocale(locale);
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
      <Link href="/" className="panel mt-6 flex items-center gap-4 rounded-2xl p-5 hover:border-amber/40">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-amber/10 text-amber"><Icon name="globe" size={24} /></span>
        <span className="flex-1"><span className="block font-semibold text-paper">Looking beyond borders?</span><span className="mt-1 block text-sm text-paper-dim">Explore worldwide launches, releases and moments.</span></span>
        <Icon name="arrow" className="shrink-0 text-muted" />
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
