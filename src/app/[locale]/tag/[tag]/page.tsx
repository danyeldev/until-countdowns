import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventTable } from "@/components/EventTable";
import { JsonLd } from "@/components/JsonLd";
import { Pager } from "@/components/Pager";
import { listEvents, listEventsStrict, tagsWithAtLeast } from "@/lib/catalog";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { i18n, localePage } from "@/lib/i18n/server";
import { collectionPage } from "@/lib/jsonld";
import { buildMetadata, displayTitle, tagTitle } from "@/lib/seo";
import { HUB_PAGE_SIZE } from "@/lib/taxonomy";

/**
 * Page 1 of a tag hub. Never reads `searchParams` (that would opt the route out of ISR);
 * pages 2+ live at `/tag/[tag]/page/[n]`.
 */
export const revalidate = 3600;

/** Below this many upcoming events a tag page is `noindex,follow` (thin content). */
const INDEX_MIN_EVENTS = 8;
/** How many tags are prerendered, in English and in everything else (each entry × 15 locales). */
const PRERENDER_TAGS = { en: 50, other: 15 };
const TAG_RE = /^[a-z0-9-]{1,60}$/;

type Props = { params: Promise<{ locale: string; tag: string }> };

export async function generateStaticParams() {
  const locale = await localeParam();
  const tags = await tagsWithAtLeast(
    INDEX_MIN_EVENTS,
    locale === DEFAULT_LOCALE ? PRERENDER_TAGS.en : PRERENDER_TAGS.other,
  );
  return tags.filter((t) => TAG_RE.test(t.tag)).map((t) => ({ tag: t.tag }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const L = await i18n();
  const { tag } = await params;
  if (!TAG_RE.test(tag)) return { title: L.m.hubs.label.tag, robots: { index: false, follow: true } };
  const result = await listEvents({ tag, sort: "soonest", page: 1, pageSize: 1 });
  return buildMetadata({
    locale: L.locale,
    title: tagTitle(L, tag),
    description: L.tn(L.m.hubs.tag.description, result.total, { tag: tag.replace(/-/g, " ") }),
    canonical: `/tag/${tag}`,
    ogPath: "/og/default",
    noindex: result.total < INDEX_MIN_EVENTS,
  });
}

export default async function TagPage({ params }: Props) {
  const L = await localePage();
  const { tag } = await params;
  if (!TAG_RE.test(tag)) notFound();
  const path = `/tag/${tag}`;

  // Strict read: a database failure renders a 500 rather than an hour-long cached 404.
  const result = await listEventsStrict({ tag, sort: "soonest", page: 1, pageSize: HUB_PAGE_SIZE.tag });
  if (result.items.length === 0) notFound();
  // A tag is a slug, not a phrase: it stays as the catalog spells it whatever the page's language.
  const label = tag.replace(/-/g, " ");

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: L.m.common.breadcrumb.home, path: "/" },
          { name: L.t(L.m.hubs.tag.crumb, { tag: label }), path },
        ]}
      />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">{L.m.hubs.label.tag}</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">{label}</h1>
      <p className="tabular mt-4 max-w-2xl text-paper-dim">{L.tn(L.m.hubs.tag.count, result.total, { tag: label })}</p>
      <EventTable events={result.items} />
      <Pager page={result.page} total={result.total} pageSize={result.pageSize} basePath={path} />
      <p className="mt-8 text-sm text-muted">
        {L.m.hubs.tag.searchPrompt}{" "}
        <Link href={L.href(`/?q=${encodeURIComponent(label)}`)} className="text-amber underline hover:text-paper">
          {L.t(L.m.hubs.tag.searchLink, { tag: label })}
        </Link>
      </p>
      <JsonLd
        data={collectionPage(
          L,
          tagTitle(L, tag),
          L.t(L.m.hubs.tag.collectionDescription, { tag: label }),
          path,
          result.items.map((e) => ({ name: displayTitle(L, e), path: `/event/${e.slug}` })),
        )}
      />
    </div>
  );
}
