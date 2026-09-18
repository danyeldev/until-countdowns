"use client";

import { Link } from "@/i18n/navigation";
import { useCollection } from "@/components/CollectionProvider";

export function CollectionEditButton({
  ownerId,
  collectionId,
}: {
  ownerId: string;
  collectionId: string;
}) {
  const { userId } = useCollection();
  if (!userId || userId !== ownerId) return null;
  return (
    <Link href={`/collections/${collectionId}/edit`} className="button-secondary">
      Edit collection
    </Link>
  );
}

export function CollectionManageLink({
  ownerId,
  collectionId,
}: {
  ownerId: string;
  collectionId: string;
}) {
  const { userId } = useCollection();
  if (!userId || userId !== ownerId) return null;
  return (
    <div className="border-t border-line px-5 py-3">
      <Link href={`/collections/${collectionId}/edit`} className="text-xs text-amber hover:underline">
        Edit collection
      </Link>
    </div>
  );
}
