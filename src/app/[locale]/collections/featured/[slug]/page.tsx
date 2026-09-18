import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventCard } from "@/components/EventCard";
import { JsonLd } from "@/components/JsonLd";
import {
  FEATURED_COLLECTION_SLUGS,
  featuredCollectionHref,
  loadFeaturedCollection,
  parseFeaturedCollectionSlug,
} from "@/lib/featured-collections";
import { collectionPage } from "@/lib/jsonld";
import { englishParams } from "@/i18n/params";
import { prerenderLimit } from "@/lib/prerender";
import { collectionListDescription, localizedMetadata } from "@/lib/seo";
import { activateLocale } from "@/i18n/request-locale";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string; locale: string }> };

export function generateStaticParams() {
  return englishParams(
    FEATURED_COLLECTION_SLUGS.slice(0, prerenderLimit(FEATURED_COLLECTION_SLUGS.length)).map(
      (slug) => ({ slug }),
    ),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  activateLocale(locale);
  const collection = await loadFeaturedCollection(slug);
  if (!collection) return { title: "Collection", robots: { index: false, follow: true } };
  return localizedMetadata({
    title: `${collection.meta.title} · Collections`,
    description: collectionListDescription(collection.meta.description, collection.events.length),
    canonical: featuredCollectionHref(collection.meta.slug),
    ogPath: `/og/featured/${collection.meta.slug}`,
    ogAlt: collection.meta.title,
    noindex: collection.events.length === 0,
    locale,
  });
}

export default async function FeaturedCollectionPage({ params }: Props) {
  const { slug: rawSlug, locale } = await params;
  activateLocale(locale);
  const slug = parseFeaturedCollectionSlug(rawSlug);
  if (!slug) notFound();
  if (rawSlug !== slug) permanentRedirect(featuredCollectionHref(slug));

  const collection = await loadFeaturedCollection(slug);
  if (!collection) notFound();
  const path = featuredCollectionHref(collection.meta.slug);

  return (
    <article>
      <Breadcrumbs
        items={[
          { name: "Until", path: "/" },
          { name: "Collections", path: "/collections" },
          { name: collection.meta.title, path },
        ]}
      />
      <JsonLd
        data={collectionPage(
          collection.meta.title,
          collection.meta.description,
          path,
          collection.events.map((item) => ({ name: item.title, path: `/event/${item.slug}` })),
        )}
      />
      <p className="eyebrow mt-6">Until&apos;s lists</p>
      <h1 className="page-heading mt-4">{collection.meta.title}</h1>
      <p className="page-subtitle mt-6 max-w-2xl">{collection.meta.description}</p>

      <section className="mt-10">
        <h2 className="section-heading">Countdowns</h2>
        {collection.events.length ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {collection.events.map((event) => (
              <EventCard key={event.slug} event={event} showSave={event.source !== "user"} />
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-paper-dim">This list does not have upcoming dates right now.</p>
        )}
      </section>
    </article>
  );
}
