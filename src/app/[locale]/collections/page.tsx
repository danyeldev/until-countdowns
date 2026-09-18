import type { Metadata } from "next";
import { CollectionCard } from "@/components/CollectionCard";
import { JsonLd } from "@/components/JsonLd";
import { AuthGateLink } from "@/components/SignInButton";
import type { CollectionSummary } from "@/lib/collections";
import { activateLocale } from "@/i18n/request-locale";
import { listPublicCollections } from "@/lib/collections-server";
import {
  featuredCollectionHref,
  listFeaturedCollections,
  type FeaturedCollection,
} from "@/lib/featured-collections";
import { collectionPage } from "@/lib/jsonld";
import { collectionHubDescription, localizedMetadata } from "@/lib/seo";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/collections">): Promise<Metadata> {
  const { locale } = await params;
  activateLocale(locale);
  const [featured, collections] = await Promise.all([listFeaturedCollections(), listPublicCollections()]);
  const featuredCount = featured.filter((item) => item.itemCount > 0).length;
  const publicCount = collections.filter((item) => item.itemCount > 0).length;
  return localizedMetadata({
    title: "Countdown collections",
    description: collectionHubDescription(featuredCount, publicCount),
    canonical: "/collections",
    ogPath: "/og/collections",
    ogAlt: "Countdown collections on Until",
    locale,
  });
}

function featuredSummary(meta: FeaturedCollection, itemCount: number): CollectionSummary {
  return {
    id: `featured-${meta.slug}`,
    slug: meta.slug,
    title: meta.title,
    description: meta.description,
    createdAt: "",
    updatedAt: "",
    owner: { id: "until", name: "Until", handle: "until" },
    itemCount,
    images: [],
  };
}

export default async function CollectionsPage({
  params,
}: PageProps<"/[locale]/collections">) {
  const { locale } = await params;
  activateLocale(locale);
  const [featured, collections] = await Promise.all([
    listFeaturedCollections(),
    listPublicCollections(),
  ]);
  const picks = featured.filter((item) => item.itemCount > 0);
  const items = [
    ...picks.map(({ meta }) => ({ name: meta.title, path: featuredCollectionHref(meta.slug) })),
    ...collections.map((collection) => ({
      name: collection.title,
      path: `/${collection.owner.handle}/${collection.slug}`,
    })),
  ];

  return (
    <div>
      <JsonLd
        data={collectionPage(
          "Countdown collections",
          "Weird little lists from Until, plus public lists people publish.",
          "/collections",
          items,
        )}
      />
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="page-heading">Collections</h1>
          <p className="page-subtitle mt-3 max-w-xl">
            Weird little lists from Until, plus whatever people publish and share.
          </p>
        </div>
        <AuthGateLink
          href="/collections/new"
          className="button-primary"
          heading="Sign in to publish a collection."
          subtitle="Use Google or your email, then share a public list of countdowns."
        >
          <span aria-hidden="true">+</span> New collection
        </AuthGateLink>
      </div>

      {picks.length ? (
        <section>
          <h2 className="section-heading">Until&apos;s lists</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {picks.map(({ meta, itemCount, coverUrl }) => (
              <CollectionCard
                key={meta.slug}
                collection={featuredSummary(meta, itemCount)}
                href={featuredCollectionHref(meta.slug)}
                byline="Until's lists"
                coverUrl={coverUrl}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className={picks.length ? "mt-14" : undefined}>
        <h2 className="section-heading">From everyone</h2>
        {collections.length ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                byline={`@${collection.owner.handle}`}
              />
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-paper-dim">
            No one has published a collection yet. Be the first — start a list and add countdowns from
            any event page.
          </p>
        )}
      </section>
    </div>
  );
}
