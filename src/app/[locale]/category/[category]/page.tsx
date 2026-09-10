import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventCard } from "@/components/EventCard";
import { EventTable } from "@/components/EventTable";
import { JsonLd } from "@/components/JsonLd";
import { Pager } from "@/components/Pager";
import { categoryCounts, eventsWithinDays, isCategory, searchEvents, seriesInCategory } from "@/lib/catalog";
import type { Localized } from "@/lib/i18n/bind";
import { i18n, localePage } from "@/lib/i18n/server";
import { collectionPage } from "@/lib/jsonld";
import { buildMetadata, categoryTitle, displayTitle } from "@/lib/seo";
import { HUB_PAGE_SIZE } from "@/lib/taxonomy";
import { CATEGORIES, type Category } from "@/lib/types";

/**
 * Page 1 of a category hub. It never reads `searchParams` (that would opt the route out of ISR);
 * pages 2+ live at `/category/[category]/page/[n]`. A stray `?category=` left by the
 * `/?category=x` 308 in next.config.ts is ignored by the static render.
 */
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string; category: string }> };

/**
 * The category label as it reads inside a sentence. English lower-cases it ("Upcoming holidays");
 * German capitalises every noun and must not — the same flag the hub titles in `seo.ts` follow.
 */
function sentenceLabel(L: Localized, category: Category): string {
  const label = L.m.categories.labels[category];
  return L.m.seo.hub.lowercaseCategory ? label.toLocaleLowerCase(L.tag) : label;
}

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const L = await i18n();
  const { category } = await params;
  if (!isCategory(category)) return { title: L.m.hubs.label.category, robots: { index: false, follow: true } };
  const counts = await categoryCounts();
  const n = counts[category] ?? 0;
  const blurb = L.m.categories.blurbs[category];
  return buildMetadata({
    locale: L.locale,
    title: categoryTitle(L, category),
    description:
      n > 0 ? L.tn(L.m.hubs.category.description, n, { blurb }) : L.t(L.m.hubs.category.descriptionEmpty, { blurb }),
    canonical: `/category/${category}`,
    ogPath: `/og/category/${category}`,
    // An empty category is a thin page: keep it reachable, out of the index (and out of the sitemap).
    noindex: n === 0,
  });
}

export default async function CategoryPage({ params }: Props) {
  const L = await localePage();
  const { category } = await params;
  if (!isCategory(category)) notFound();
  const path = `/category/${category}`;

  const [soon, result, series] = await Promise.all([
    eventsWithinDays({ category, maxDays: 30, sort: "popular", limit: 6 }),
    searchEvents({ category, sort: "soonest", page: 1, pageSize: HUB_PAGE_SIZE.category }),
    seriesInCategory(category, 12),
  ]);
  const label = L.m.categories.labels[category];
  const inSentence = sentenceLabel(L, category);
  const heading = L.t(L.m.hubs.category.heading, { category: inSentence });

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: L.m.common.breadcrumb.home, path: "/" },
          { name: L.m.common.nav.categories, path: "/category" },
          { name: label, path },
        ]}
      />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">{L.m.hubs.label.category}</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">{heading}</h1>
      <p className="mt-4 max-w-2xl text-paper-dim">{L.m.categories.blurbs[category]}</p>
      <p className="tabular mt-2 text-sm text-muted">{L.tn(L.m.hubs.category.count, result.total)}</p>

      {soon.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-serif text-2xl text-paper">{L.m.hubs.category.soon}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {soon.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ) : null}

      {series.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-serif text-2xl text-paper">{L.m.hubs.category.everyYear}</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {series.map((s) => (
              <li key={s.slug}>
                <Link href={L.href(`/days-until/${s.slug}`)} className="inline-flex items-baseline gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-paper-dim hover:text-paper">
                  {displayTitle(L, s)}
                  <span className="tabular font-mono text-xs text-muted">
                    {s.nextDate ? (typeof s.daysUntil === "number" ? L.fmt.humanDays(s.daysUntil) : L.fmt.shortDate(s.nextDate)) : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-paper">{L.t(L.m.hubs.category.all, { category: inSentence })}</h2>
        <EventTable events={result.items} showCategory={false} emptyText={L.m.hubs.category.empty} />
        <Pager page={1} total={result.total} pageSize={result.pageSize} basePath={path} />
      </section>

      <JsonLd
        data={collectionPage(
          L,
          heading,
          L.m.categories.blurbs[category],
          path,
          result.items.map((e) => ({ name: displayTitle(L, e), path: `/event/${e.slug}` })),
        )}
      />
    </div>
  );
}
