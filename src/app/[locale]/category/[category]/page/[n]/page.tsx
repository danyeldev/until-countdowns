import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventTable } from "@/components/EventTable";
import { JsonLd } from "@/components/JsonLd";
import { Pager } from "@/components/Pager";
import { isCategory, listEventsStrict } from "@/lib/catalog";
import { collectionPage } from "@/lib/jsonld";
import { CATEGORY_BLURB, CATEGORY_LABELS } from "@/lib/labels";
import { buildMetadata, categoryTitle } from "@/lib/seo";
import { HUB_MAX_PAGE, HUB_PAGE_SIZE } from "@/lib/taxonomy";

/**
 * Pages 2+ of a category hub (`/category/[category]/page/[n]`). ISR like page 1, rendered on
 * first visit (no prerendered params), `noindex,follow` with a self canonical and prev/next links.
 */
export const revalidate = 3600;

type Props = { params: Promise<{ category: string; n: string }> };

/** Only canonical page numbers exist: `2`…`MAX_PAGE`, no leading zeros (`/page/1` is the hub itself). */
function pageNumber(raw: string): number | null {
  if (!/^[1-9]\d{0,3}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 2 && n <= HUB_MAX_PAGE.category ? n : null;
}

export function generateStaticParams(): { category: string; n: string }[] {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, n: raw } = await params;
  const n = pageNumber(raw);
  if (!isCategory(category) || n === null) return { title: "Category", robots: { index: false, follow: true } };
  return buildMetadata({
    title: `${categoryTitle(category)} (page ${n})`,
    description: `${CATEGORY_BLURB[category]} Page ${n} of the upcoming dates, soonest first, with live countdowns and calendar links.`,
    canonical: `/category/${category}/page/${n}`,
    ogPath: `/og/category/${category}`,
    noindex: true,
  });
}

export default async function CategoryPageN({ params }: Props) {
  const { category, n: raw } = await params;
  const n = pageNumber(raw);
  if (!isCategory(category) || n === null) notFound();
  const basePath = `/category/${category}`;
  const path = `${basePath}/page/${n}`;
  const label = CATEGORY_LABELS[category];

  // Strict read: a database failure renders a 500 rather than an hour-long cached 404.
  const result = await listEventsStrict({ category, sort: "soonest", page: n, pageSize: HUB_PAGE_SIZE.category });
  if (result.items.length === 0) notFound();

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Categories", path: "/category" },
          { name: label, path: basePath },
          { name: `Page ${n}`, path },
        ]}
      />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">Category</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">
        Upcoming {label.toLowerCase()} <span className="text-muted">— page {n}</span>
      </h1>
      <p className="mt-4 max-w-2xl text-paper-dim">
        {CATEGORY_BLURB[category]}{" "}
        <Link href={basePath} className="text-amber underline hover:text-paper">
          Back to the first page
        </Link>
        .
      </p>
      <p className="tabular mt-2 text-sm text-muted">
        {result.total.toLocaleString("en-US")} upcoming {result.total === 1 ? "date" : "dates"}, soonest first.
      </p>

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-paper">All upcoming {label.toLowerCase()}</h2>
        <EventTable events={result.items} showCategory={false} />
        <Pager page={n} total={result.total} pageSize={result.pageSize} basePath={basePath} />
      </section>

      <JsonLd
        data={collectionPage(
          `Upcoming ${label.toLowerCase()} (page ${n})`,
          CATEGORY_BLURB[category],
          path,
          result.items.map((e) => ({ name: e.title, path: `/event/${e.slug}` })),
        )}
      />
    </div>
  );
}
