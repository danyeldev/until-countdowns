import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventTable } from "@/components/EventTable";
import { JsonLd } from "@/components/JsonLd";
import { Pager } from "@/components/Pager";
import { isCategory, listEventsStrict } from "@/lib/catalog";
import type { Localized } from "@/lib/i18n/bind";
import { i18n, localePage } from "@/lib/i18n/server";
import { collectionPage } from "@/lib/jsonld";
import { buildMetadata, categoryTitle, displayTitle } from "@/lib/seo";
import { HUB_MAX_PAGE, HUB_PAGE_SIZE } from "@/lib/taxonomy";
import type { Category } from "@/lib/types";

/**
 * Pages 2+ of a category hub (`/category/[category]/page/[n]`). ISR like page 1, rendered on
 * first visit (no prerendered params), `noindex,follow` with a self canonical and prev/next links.
 */
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string; category: string; n: string }> };

/** Only canonical page numbers exist: `2`…`MAX_PAGE`, no leading zeros (`/page/1` is the hub itself). */
function pageNumber(raw: string): number | null {
  if (!/^[1-9]\d{0,3}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 2 && n <= HUB_MAX_PAGE.category ? n : null;
}

/** As on page 1: whether the label is lower-cased inside a sentence is the locale's call. */
function sentenceLabel(L: Localized, category: Category): string {
  const label = L.m.categories.labels[category];
  return L.m.seo.hub.lowercaseCategory ? label.toLocaleLowerCase(L.tag) : label;
}

export function generateStaticParams(): { category: string; n: string }[] {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const L = await i18n();
  const { category, n: raw } = await params;
  const n = pageNumber(raw);
  if (!isCategory(category) || n === null) {
    return { title: L.m.hubs.label.category, robots: { index: false, follow: true } };
  }
  return buildMetadata({
    locale: L.locale,
    title: L.t(L.m.hubs.paged.title, { name: categoryTitle(L, category), n: L.fmt.number(n) }),
    description: L.t(L.m.hubs.category.descriptionPaged, {
      blurb: L.m.categories.blurbs[category],
      n: L.fmt.number(n),
    }),
    canonical: `/category/${category}/page/${n}`,
    ogPath: `/og/category/${category}`,
    noindex: true,
    // A page that asks not to be indexed has no business advertising fourteen siblings.
    translated: false,
  });
}

export default async function CategoryPageN({ params }: Props) {
  const L = await localePage();
  const { category, n: raw } = await params;
  const n = pageNumber(raw);
  if (!isCategory(category) || n === null) notFound();
  const basePath = `/category/${category}`;
  const path = `${basePath}/page/${n}`;
  const label = L.m.categories.labels[category];
  const inSentence = sentenceLabel(L, category);
  const heading = L.t(L.m.hubs.category.heading, { category: inSentence });

  // Strict read: a database failure renders a 500 rather than an hour-long cached 404.
  const result = await listEventsStrict({ category, sort: "soonest", page: n, pageSize: HUB_PAGE_SIZE.category });
  if (result.items.length === 0) notFound();

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: L.m.common.breadcrumb.home, path: "/" },
          { name: L.m.common.nav.categories, path: "/category" },
          { name: label, path: basePath },
          { name: L.t(L.m.common.pagination.page, { n: L.fmt.number(n) }), path },
        ]}
      />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">{L.m.hubs.label.category}</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">
        {heading} <span className="text-muted">{L.t(L.m.hubs.paged.headingSuffix, { n: L.fmt.number(n) })}</span>
      </h1>
      <p className="mt-4 max-w-2xl text-paper-dim">
        {L.m.categories.blurbs[category]}{" "}
        <Link href={L.href(basePath)} className="text-amber underline hover:text-paper">
          {L.m.hubs.paged.backToFirst}
        </Link>
      </p>
      <p className="tabular mt-2 text-sm text-muted">{L.tn(L.m.hubs.category.countPaged, result.total)}</p>

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-paper">{L.t(L.m.hubs.category.all, { category: inSentence })}</h2>
        <EventTable events={result.items} showCategory={false} />
        <Pager page={n} total={result.total} pageSize={result.pageSize} basePath={basePath} />
      </section>

      <JsonLd
        data={collectionPage(
          L,
          L.t(L.m.hubs.paged.title, { name: heading, n: L.fmt.number(n) }),
          L.m.categories.blurbs[category],
          path,
          result.items.map((e) => ({ name: displayTitle(L, e), path: `/event/${e.slug}` })),
        )}
      />
    </div>
  );
}
