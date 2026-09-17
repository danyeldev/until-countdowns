import { englishParams } from "@/i18n/params";
import { prerenderLimit } from "@/lib/prerender";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventTable } from "@/components/EventTable";
import { Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { Pager } from "@/components/Pager";
import { listEvents, listEventsStrict, tagsWithAtLeast } from "@/lib/catalog";
import { collectionPage } from "@/lib/jsonld";
import { tagTitle, localizedMetadata } from "@/lib/seo";
import { HUB_PAGE_SIZE } from "@/lib/taxonomy";

/**
 * Page 1 of a tag hub. Never reads `searchParams` (that would opt the route out of ISR);
 * pages 2+ live at `/tag/[tag]/page/[n]`.
 */
export const revalidate = 3600;

/** Below this many upcoming events a tag page is `noindex,follow` (thin content). */
const INDEX_MIN_EVENTS = 8;
const PRERENDER_TAGS = 50;
const TAG_RE = /^[a-z0-9-]{1,60}$/;

type Props = { params: Promise<{ tag: string }> };

export async function generateStaticParams() {
  const limit = prerenderLimit(PRERENDER_TAGS);
  if (!limit) return [];
  const tags = await tagsWithAtLeast(INDEX_MIN_EVENTS, limit);
  return englishParams(tags.filter((t) => TAG_RE.test(t.tag)).map((t) => ({ tag: t.tag })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  if (!TAG_RE.test(tag)) return { title: "Tag", robots: { index: false, follow: true } };
  const result = await listEvents({ tag, sort: "soonest", page: 1, pageSize: 1 });
  return localizedMetadata({
    title: tagTitle(tag),
    description: `${result.total.toLocaleString("en-US")} upcoming dates tagged "${tag.replace(/-/g, " ")}", soonest first, each with a live countdown and calendar links.`,
    canonical: `/tag/${tag}`,
    ogPath: "/og/default",
    noindex: result.total < INDEX_MIN_EVENTS,
  });
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params;
  if (!TAG_RE.test(tag)) notFound();
  const path = `/tag/${tag}`;

  // Strict read: a database failure renders a 500 rather than an hour-long cached 404.
  const result = await listEventsStrict({ tag, sort: "soonest", page: 1, pageSize: HUB_PAGE_SIZE.tag });
  if (result.items.length === 0) notFound();
  const label = tag.replace(/-/g, " ");

  return (
    <div>
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: `#${label}`, path }]} />
      <p className="eyebrow mt-7">Tag</p>
      <h1 className="page-heading mt-3">{label}</h1>
      <p className="tabular page-subtitle mt-3 max-w-2xl">
        {result.total.toLocaleString("en-US")} upcoming {result.total === 1 ? "date" : "dates"} tagged “{label}”, soonest first.
      </p>
      <EventTable events={result.items} />
      <Pager page={result.page} total={result.total} pageSize={result.pageSize} basePath={path} />
      <div className="hairline mt-12 flex flex-wrap items-center justify-between gap-4 pt-8">
        <div><p className="font-medium text-paper">Keep exploring</p><p className="mt-1 text-sm text-muted">Find related moments across the catalog.</p></div>
        <Link href={`/?q=${encodeURIComponent(label)}`} className="button-secondary"><Icon name="search" size={16} /> Search “{label}”</Link>
      </div>
      <JsonLd
        data={collectionPage(
          tagTitle(tag),
          `Upcoming dates tagged ${label}.`,
          path,
          result.items.map((e) => ({ name: e.title, path: `/event/${e.slug}` })),
        )}
      />
    </div>
  );
}
