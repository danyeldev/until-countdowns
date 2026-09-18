import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound, permanentRedirect } from "next/navigation";
import Image from "next/image";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventCard } from "@/components/EventCard";
import { JsonLd } from "@/components/JsonLd";
import { CollectionEditButton } from "@/components/CollectionManageLink";
import { activateLocale } from "@/i18n/request-locale";
import { parseProfileParam, profileHref } from "@/lib/auth/profile";
import { parseCollectionSlug, collectionHref, collectionImageUrl, collectionItemHref } from "@/lib/collections";
import { getPublicCollectionServer } from "@/lib/collections-server";
import { collectionPage } from "@/lib/jsonld";
import { collectionListDescription, localizedMetadata } from "@/lib/seo";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[handle]/[collection]">): Promise<Metadata> {
  const { handle: rawHandle, collection: rawSlug, locale } = await params;
  activateLocale(locale);
  const handle = parseProfileParam(rawHandle);
  const slug = parseCollectionSlug(rawSlug);
  const collection = handle && slug ? await getPublicCollectionServer(handle, slug) : null;
  if (!collection) return { title: "Collection", robots: { index: false, follow: true } };
  return localizedMetadata({
    title: `${collection.title} · @${collection.owner.handle}`,
    description: collectionListDescription(
      collection.description || `${collection.title} — a public countdown collection by ${collection.owner.name}.`,
      collection.items.length,
    ),
    canonical: collectionHref(collection.owner.handle, collection.slug),
    ogPath: `/og/collection/${collection.owner.handle}/${collection.slug}`,
    ogAlt: collection.title,
    noindex: collection.items.length === 0,
    locale,
  });
}

export default async function PublicCollectionPage({ params }: PageProps<"/[locale]/[handle]/[collection]">) {
  const { handle: rawHandle, collection: rawSlug, locale } = await params;
  activateLocale(locale);
  const handle = parseProfileParam(rawHandle);
  const slug = parseCollectionSlug(rawSlug);
  if (!handle || !slug) notFound();
  if (rawHandle !== handle || rawSlug !== slug) permanentRedirect(collectionHref(handle, slug));

  const collection = await getPublicCollectionServer(handle, slug);
  if (!collection) notFound();

  const path = collectionHref(collection.owner.handle, collection.slug);

  return (
    <article>
      <Breadcrumbs
        items={[
          { name: "Until", path: "/" },
          { name: `@${collection.owner.handle}`, path: profileHref(collection.owner.handle) },
          { name: collection.title, path },
        ]}
      />
      <JsonLd
        data={collectionPage(
          collection.title,
          collection.description || `${collection.title} by ${collection.owner.name}`,
          path,
          collection.items.map((item) => ({ name: item.title, path: collectionItemHref(item) })),
        )}
      />
      <p className="eyebrow mt-6">Public collection</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-heading">{collection.title}</h1>
          <p className="mt-2 text-sm text-amber">
            <Link href={profileHref(collection.owner.handle)} className="hover:underline">
              @{collection.owner.handle}
            </Link>
          </p>
        </div>
        <CollectionEditButton ownerId={collection.owner.id} collectionId={collection.id} />
      </div>
      {collection.description ? <p className="page-subtitle mt-6 max-w-2xl">{collection.description}</p> : null}

      {collection.images.length ? (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {collection.images.map((image) => (
            <li key={image.id} className="relative aspect-4/3 overflow-hidden rounded-2xl border border-line bg-ink-2">
              <Image
                src={collectionImageUrl(image.path)}
                alt=""
                fill
                unoptimized
                className="object-cover"
                sizes="(max-width: 640px) 50vw, 33vw"
              />
            </li>
          ))}
        </ul>
      ) : null}

      <section className="mt-10">
        <h2 className="section-heading">Countdowns</h2>
        {collection.items.length ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {collection.items.map((event) => (
              <EventCard
                key={event.slug}
                event={event}
                href={collectionItemHref(event)}
                showSave={event.source !== "user"}
              />
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-paper-dim">This collection does not have countdowns yet.</p>
        )}
      </section>
    </article>
  );
}
