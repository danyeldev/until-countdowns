import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventCard } from "@/components/EventCard";
import { EventTable } from "@/components/EventTable";
import { JsonLd } from "@/components/JsonLd";
import { Pager } from "@/components/Pager";
import { categoryCounts, eventsWithinDays, isCategory, searchEvents, seriesInCategory } from "@/lib/catalog";
import { collectionPage } from "@/lib/jsonld";
import { CATEGORY_BLURB, CATEGORY_LABELS } from "@/lib/labels";
import { buildMetadata, categoryTitle, formatShortDate } from "@/lib/seo";
import { HUB_PAGE_SIZE } from "@/lib/taxonomy";
import { humanDays } from "@/lib/time";
import { CATEGORIES } from "@/lib/types";

/**
 * Page 1 of a category hub. It never reads `searchParams` (that would opt the route out of ISR);
 * pages 2+ live at `/category/[category]/page/[n]`. A stray `?category=` left by the
 * `/?category=x` 308 in next.config.ts is ignored by the static render.
 */
export const revalidate = 3600;

type Props = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  if (!isCategory(category)) return { title: "Category", robots: { index: false, follow: true } };
  const counts = await categoryCounts();
  const n = counts[category] ?? 0;
  return buildMetadata({
    title: categoryTitle(category),
    description: `${CATEGORY_BLURB[category]} ${n > 0 ? `${n.toLocaleString("en-US")} upcoming dates` : "Upcoming dates"} with live countdowns and calendar links.`,
    canonical: `/category/${category}`,
    ogPath: `/og/category/${category}`,
    // An empty category is a thin page: keep it reachable, out of the index (and out of the sitemap).
    noindex: n === 0,
  });
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  if (!isCategory(category)) notFound();
  const path = `/category/${category}`;

  const [soon, result, series] = await Promise.all([
    eventsWithinDays({ category, maxDays: 30, sort: "popular", limit: 6 }),
    searchEvents({ category, sort: "soonest", page: 1, pageSize: HUB_PAGE_SIZE.category }),
    seriesInCategory(category, 12),
  ]);
  const label = CATEGORY_LABELS[category];

  return (
    <div>
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Categories", path: "/category" }, { name: label, path }]} />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">Category</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">Upcoming {label.toLowerCase()}</h1>
      <p className="mt-4 max-w-2xl text-paper-dim">{CATEGORY_BLURB[category]}</p>
      <p className="tabular mt-2 text-sm text-muted">
        {result.total.toLocaleString("en-US")} upcoming {result.total === 1 ? "date" : "dates"}.
      </p>

      {soon.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-serif text-2xl text-paper">Next 30 days</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {soon.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ) : null}

      {series.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-serif text-2xl text-paper">Every year</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {series.map((s) => (
              <li key={s.slug}>
                <Link href={`/days-until/${s.slug}`} className="inline-flex items-baseline gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-paper-dim hover:text-paper">
                  {s.title}
                  <span className="tabular font-mono text-xs text-muted">
                    {s.nextDate ? (typeof s.daysUntil === "number" ? humanDays(s.daysUntil) : formatShortDate(s.nextDate)) : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-paper">All upcoming {label.toLowerCase()}</h2>
        <EventTable events={result.items} showCategory={false} emptyText="Nothing in this category yet." />
        <Pager page={1} total={result.total} pageSize={result.pageSize} basePath={path} />
      </section>

      <JsonLd
        data={collectionPage(
          `Upcoming ${label.toLowerCase()}`,
          CATEGORY_BLURB[category],
          path,
          result.items.map((e) => ({ name: e.title, path: `/event/${e.slug}` })),
        )}
      />
    </div>
  );
}
