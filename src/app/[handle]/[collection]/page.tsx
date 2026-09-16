import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import Image from "next/image";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EventCard } from "@/components/EventCard";
import { JsonLd } from "@/components/JsonLd";
import { getOwnProfile } from "@/lib/auth/server";
import { parseProfileParam, profileHref } from "@/lib/auth/profile";
import { parseCollectionSlug, collectionHref, collectionImageUrl, collectionItemHref } from "@/lib/collections";
import { getPublicCollectionServer } from "@/lib/collections-server";
import { collectionPage } from "@/lib/jsonld";
import { buildMetadata, truncate } from "@/lib/seo";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: PageProps<"/[handle]/[collection]">): Promise<Metadata> {
  const { handle: rawHandle, collection: rawSlug } = await params;
  const handle = parseProfileParam(rawHandle);
  const slug = parseCollectionSlug(rawSlug);
  const collection = handle && slug ? await getPublicCollectionServer(handle, slug) : null;
  if (!collection) return { title: "Collection", robots: { index: false, follow: true } };
  return buildMetadata({
    title: `${collection.title} · @${collection.owner.handle}`,
    description: truncate(
      collection.description || `${collection.title} — a public countdown collection by ${collection.owner.name}.`,
    ),
    canonical: collectionHref(collection.owner.handle, collection.slug),
    ogPath: "/og/default",
    ogAlt: collection.title,
  });
}

export default async function PublicCollectionPage({ params }: PageProps<"/[handle]/[collection]">) {
  const { handle: rawHandle, collection: rawSlug } = await params;
  const handle = parseProfileParam(rawHandle);
  const slug = parseCollectionSlug(rawSlug);
  if (!handle || !slug) notFound();
  if (rawHandle !== handle || rawSlug !== slug) permanentRedirect(collectionHref(handle, slug));

  const collection = await getPublicCollectionServer(handle, slug);
  if (!collection) notFound();

  const own = await getOwnProfile();
  const isOwn = own?.handle === collection.owner.handle;
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
        {isOwn ? (
          <Link href={`/collections/${collection.id}/edit`} className="button-secondary">
            Edit collection
          </Link>
        ) : null}
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
