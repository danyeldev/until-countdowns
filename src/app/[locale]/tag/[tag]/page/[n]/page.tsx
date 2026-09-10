import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventTable } from "@/components/EventTable";
import { JsonLd } from "@/components/JsonLd";
import { Pager } from "@/components/Pager";
import { listEventsStrict } from "@/lib/catalog";
import { i18n, localePage } from "@/lib/i18n/server";
import { collectionPage } from "@/lib/jsonld";
import { buildMetadata, displayTitle, tagTitle } from "@/lib/seo";
import { HUB_MAX_PAGE, HUB_PAGE_SIZE } from "@/lib/taxonomy";

/**
 * Pages 2+ of a tag hub (`/tag/[tag]/page/[n]`): ISR, rendered on first visit, `noindex,follow`
 * with a self canonical and prev/next links.
 */
export const revalidate = 3600;

const TAG_RE = /^[a-z0-9-]{1,60}$/;

type Props = { params: Promise<{ locale: string; tag: string; n: string }> };

function pageNumber(raw: string): number | null {
  if (!/^[1-9]\d{0,3}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 2 && n <= HUB_MAX_PAGE.tag ? n : null;
}

export function generateStaticParams(): { tag: string; n: string }[] {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const L = await i18n();
  const { tag, n: raw } = await params;
  const n = pageNumber(raw);
  if (!TAG_RE.test(tag) || n === null) return { title: L.m.hubs.label.tag, robots: { index: false, follow: true } };
  const label = tag.replace(/-/g, " ");
  return buildMetadata({
    locale: L.locale,
    title: L.t(L.m.hubs.paged.title, { name: tagTitle(L, tag), n: L.fmt.number(n) }),
    description: L.t(L.m.hubs.tag.descriptionPaged, { tag: label, n: L.fmt.number(n) }),
    canonical: `/tag/${tag}/page/${n}`,
    ogPath: "/og/default",
    noindex: true,
    // A page that asks not to be indexed has no business advertising fourteen siblings.
    translated: false,
  });
}

export default async function TagPageN({ params }: Props) {
  const L = await localePage();
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
      <Breadcrumbs
        items={[
          { name: L.m.common.breadcrumb.home, path: "/" },
          { name: L.t(L.m.hubs.tag.crumb, { tag: label }), path: basePath },
          { name: L.t(L.m.common.pagination.page, { n: L.fmt.number(n) }), path },
        ]}
      />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">{L.m.hubs.label.tag}</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">
        {label} <span className="text-muted">{L.t(L.m.hubs.paged.headingSuffix, { n: L.fmt.number(n) })}</span>
      </h1>
      <p className="tabular mt-4 max-w-2xl text-paper-dim">
        {L.tn(L.m.hubs.tag.count, result.total, { tag: label })}{" "}
        <Link href={L.href(basePath)} className="text-amber underline hover:text-paper">
          {L.m.hubs.paged.backToFirst}
        </Link>
      </p>
      <EventTable events={result.items} />
      <Pager page={n} total={result.total} pageSize={result.pageSize} basePath={basePath} />
      <JsonLd
        data={collectionPage(
          L,
          L.t(L.m.hubs.paged.title, { name: tagTitle(L, tag), n: L.fmt.number(n) }),
          L.t(L.m.hubs.tag.collectionDescription, { tag: label }),
          path,
          result.items.map((e) => ({ name: displayTitle(L, e), path: `/event/${e.slug}` })),
        )}
      />
    </div>
  );
}
