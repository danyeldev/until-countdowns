import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { collectionCover, collectionHref, collectionImageUrl, type CollectionSummary } from "@/lib/collections";
import { Icon } from "./Icon";

export function CollectionCard({
  collection,
  href,
  manageHref,
  byline,
  coverUrl,
}: {
  collection: CollectionSummary;
  href?: string;
  manageHref?: string;
  byline?: string;
  coverUrl?: string | null;
}) {
  const path = href ?? collectionHref(collection.owner.handle, collection.slug);
  const stored = collectionCover(collection.images);
  const src = coverUrl || (stored ? collectionImageUrl(stored.path) : "");
  return (
    <article className="panel overflow-hidden">
      <Link href={path} className="block">
        <div className="relative aspect-16/9 bg-ink-2">
          {src ? (
            <Image
              src={src}
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
          <h3 className="text-[17px] font-semibold tracking-[-.025em] text-paper">{collection.title}</h3>
          {collection.description ? (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-paper-dim">{collection.description}</p>
          ) : null}
          <p className="mt-3 text-xs text-muted">
            {collection.itemCount} countdown{collection.itemCount === 1 ? "" : "s"}
            {byline ? ` · ${byline}` : ""}
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
