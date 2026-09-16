import Link from "next/link";
import { notFound } from "next/navigation";
import { CollectionEditor } from "@/components/CollectionEditor";
import { requireAuth } from "@/lib/auth/server";
import { getOwnCollectionServer } from "@/lib/collections-server";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Edit collection",
  description: "Update a public countdown collection.",
  canonical: "/collections",
  ogPath: "/og/default",
  noindex: true,
});

export default async function EditCollectionPage({ params }: PageProps<"/collections/[id]/edit">) {
  await requireAuth("/collections");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const collection = await getOwnCollectionServer(id);
  if (!collection) notFound();
  return (
    <div>
      <Link href="/collections" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-paper">
        <span aria-hidden="true">←</span> Collections
      </Link>
      <h1 className="page-heading">Edit collection</h1>
      <p className="page-subtitle mt-3 max-w-xl">Change the title, note, photos, or remove countdowns.</p>
      <div className="mt-8">
        <CollectionEditor initial={collection} />
      </div>
    </div>
  );
}
