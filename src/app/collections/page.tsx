import Link from "next/link";
import { CollectionCard } from "@/components/CollectionCard";
import { requireAuth } from "@/lib/auth/server";
import { listOwnCollectionsServer } from "@/lib/collections-server";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Your collections",
  description: "Create public collections of countdowns. Share a list from your Until profile.",
  canonical: "/collections",
  ogPath: "/og/default",
  noindex: true,
});

export default async function CollectionsPage() {
  await requireAuth("/collections");
  const collections = await listOwnCollectionsServer();
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="page-heading">Collections</h1>
          <p className="page-subtitle mt-3 max-w-xl">
            Public lists of countdowns. Anyone can open them from your profile.
          </p>
        </div>
        <Link href="/collections/new" className="button-primary">
          <span aria-hidden="true">+</span> New collection
        </Link>
      </div>
      {collections.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              manageHref={`/collections/${collection.id}/edit`}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p className="text-sm text-paper-dim">
            You have not published a collection yet. Make one, then add countdowns from any event page.
          </p>
          <Link href="/collections/new" className="button-primary mt-6">
            Create a collection
          </Link>
        </div>
      )}
    </div>
  );
}
