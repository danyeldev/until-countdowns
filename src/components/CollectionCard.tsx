import Image from "next/image";
import Link from "next/link";
import { collectionCover, collectionHref, collectionImageUrl, type CollectionSummary } from "@/lib/collections";
import { Icon } from "./Icon";

export function CollectionCard({
  collection,
  href,
  manageHref,
}: {
  collection: CollectionSummary;
  href?: string;
  manageHref?: string;
}) {
  const path = href ?? collectionHref(collection.owner.handle, collection.slug);
  const cover = collectionCover(collection.images);
  return (
    <article className="panel overflow-hidden">
      <Link href={path} className="block">
        <div className="relative aspect-16/9 bg-ink-2">
          {cover ? (
            <Image
              src={collectionImageUrl(cover.path)}
              alt=""
              fill
              unoptimized
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-amber/70">
              <Icon name="list" size={28} />
            </div>
          )}
        </div>
        <div className="p-5">
          <h2 className="text-[17px] font-semibold tracking-[-.025em] text-paper">{collection.title}</h2>
          {collection.description ? (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-paper-dim">{collection.description}</p>
          ) : null}
          <p className="mt-3 text-xs text-muted">
            {collection.itemCount} countdown{collection.itemCount === 1 ? "" : "s"}
          </p>
        </div>
      </Link>
      {manageHref ? (
        <div className="border-t border-line px-5 py-3">
          <Link href={manageHref} className="text-xs text-amber hover:underline">
            Edit collection
          </Link>
        </div>
      ) : null}
    </article>
  );
}
