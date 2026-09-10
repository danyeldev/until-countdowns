import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventTable } from "@/components/EventTable";
import { JsonLd } from "@/components/JsonLd";
import { Pager } from "@/components/Pager";
import { listEventsStrict } from "@/lib/catalog";
import { collectionPage } from "@/lib/jsonld";
import { buildMetadata, tagTitle } from "@/lib/seo";
import { HUB_MAX_PAGE, HUB_PAGE_SIZE } from "@/lib/taxonomy";

/**
 * Pages 2+ of a tag hub (`/tag/[tag]/page/[n]`): ISR, rendered on first visit, `noindex,follow`
 * with a self canonical and prev/next links.
 */
export const revalidate = 3600;

const TAG_RE = /^[a-z0-9-]{1,60}$/;

type Props = { params: Promise<{ tag: string; n: string }> };

function pageNumber(raw: string): number | null {
  if (!/^[1-9]\d{0,3}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 2 && n <= HUB_MAX_PAGE.tag ? n : null;
}

export function generateStaticParams(): { tag: string; n: string }[] {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag, n: raw } = await params;
  const n = pageNumber(raw);
  if (!TAG_RE.test(tag) || n === null) return { title: "Tag", robots: { index: false, follow: true } };
  const label = tag.replace(/-/g, " ");
  return buildMetadata({
    title: `${tagTitle(tag)} (page ${n})`,
    description: `Page ${n} of the upcoming dates tagged "${label}", soonest first, each with a live countdown and calendar links.`,
    canonical: `/tag/${tag}/page/${n}`,
    ogPath: "/og/default",
    noindex: true,
  });
}

export default async function TagPageN({ params }: Props) {
  const { tag, n: raw } = await params;
  const n = pageNumber(raw);
  if (!TAG_RE.test(tag) || n === null) notFound();
  const basePath = `/tag/${tag}`;
  const path = `${basePath}/page/${n}`;
  const label = tag.replace(/-/g, " ");

  const result = await listEventsStrict({ tag, sort: "soonest", page: n, pageSize: HUB_PAGE_SIZE.tag });
  if (result.items.length === 0) notFound();

  return (
    <div>
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: `#${label}`, path: basePath }, { name: `Page ${n}`, path }]} />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">Tag</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">
        {label} <span className="text-muted">— page {n}</span>
      </h1>
      <p className="tabular mt-4 max-w-2xl text-paper-dim">
        {result.total.toLocaleString("en-US")} upcoming {result.total === 1 ? "date" : "dates"} tagged “{label}”, soonest first.{" "}
        <Link href={basePath} className="text-amber underline hover:text-paper">
          Back to the first page
        </Link>
        .
      </p>
      <EventTable events={result.items} />
      <Pager page={n} total={result.total} pageSize={result.pageSize} basePath={basePath} />
      <JsonLd
        data={collectionPage(
          `${tagTitle(tag)} (page ${n})`,
          `Upcoming dates tagged ${label}.`,
          path,
          result.items.map((e) => ({ name: e.title, path: `/event/${e.slug}` })),
        )}
      />
    </div>
  );
}
