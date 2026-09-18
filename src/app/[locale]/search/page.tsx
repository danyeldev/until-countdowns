import type { Metadata } from "next";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { CatalogExplorer } from "@/components/CatalogExplorer";
import { activateLocale } from "@/i18n/request-locale";
import { localeOf } from "@/i18n/locales";
import { redirect } from "@/i18n/navigation";
import {
  categoryCounts,
  futureOccurrencesForEvents,
  logSearch,
  searchEvents,
} from "@/lib/catalog";
import { searchCollections } from "@/lib/search-collections-server";
import { localizedMetadata } from "@/lib/seo";
import {
  CATEGORIES,
  DEFAULT_EVENT_SORT,
  isEventSort,
  type Category,
  type EventSort,
} from "@/lib/types";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseQuery(sp: Record<string, string | string[] | undefined>) {
  const q = first(sp.q)?.trim().slice(0, 80) || undefined;
  const categoryRaw = first(sp.category);
  const category = CATEGORIES.includes(categoryRaw as Category)
    ? (categoryRaw as Category)
    : undefined;
  const sortRaw = first(sp.sort);
  const sort: EventSort = isEventSort(sortRaw) ? sortRaw : DEFAULT_EVENT_SORT;
  const page = Math.min(1000, Math.max(1, Math.floor(Number(first(sp.page))) || 1));
  return { q, category, sort, page };
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[locale]/search">): Promise<Metadata> {
  const { locale } = await params;
  activateLocale(locale);
  const { q } = parseQuery(await searchParams);
  return localizedMetadata({
    title: q ? `Search “${q}”` : "Search countdowns",
    description: q
      ? `Upcoming dates matching “${q}” on Until.`
      : "Search holidays, sports, space, and culture on Until.",
    canonical: "/search",
    ogPath: "/og/default",
    noindex: true,
    locale,
  });
}

export default async function SearchPage({
  params,
  searchParams,
}: PageProps<"/[locale]/search">) {
  const { locale } = await params;
  activateLocale(locale);
  const { q, category, sort, page } = parseQuery(await searchParams);

  const [mix, counts, collections] = await Promise.all([
    searchEvents({ q, category, sort, page, pageSize: 12 }).then(async (result) => ({
      result,
      futureOccurrences: await futureOccurrencesForEvents(result.items),
    })),
    categoryCounts(),
    q && page === 1 ? searchCollections(q, 6) : Promise.resolve([]),
  ]);
  const { result, futureOccurrences } = mix;

  if (result.items.length === 0 && page > 1) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (category) p.set("category", category);
    if (sort !== DEFAULT_EVENT_SORT) p.set("sort", sort);
    const qs = p.toString();
    redirect({ href: qs ? `/search?${qs}` : "/search", locale: localeOf(locale) });
  }

  if (q) {
    const total = result.total;
    after(() => logSearch(q, total));
  }

  const t = await getTranslations("home");
  const nav = await getTranslations("nav");
  return (
    <div className="reveal">
      <div className="mb-7">
        <h1 className="page-heading">
          {q ? t("resultsFor", { query: q }) : nav("explore")}
        </h1>
        {!q && (
          <p className="page-subtitle">
            Find your next event, holiday or favorite tradition.
          </p>
        )}
      </div>
      <CatalogExplorer
        events={result.items}
        futureOccurrences={futureOccurrences}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        q={q}
        category={category}
        sort={sort}
        counts={counts}
        collections={collections}
        basePath="/search"
      />
    </div>
  );
}
