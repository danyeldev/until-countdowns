import { Link } from "@/i18n/navigation";
import type { CollectionSearchHit } from "@/lib/search-collections";
import { Icon } from "./Icon";

export function CollectionSearchHits({ hits }: { hits: CollectionSearchHit[] }) {
  if (!hits.length) return null;
  return (
    <section>
      <h2 className="section-heading">Collections</h2>
      <ul className="mt-3 grid gap-x-8 sm:grid-cols-2">
        {hits.map((hit) => (
          <li key={hit.id} className="border-t border-line">
            <Link
              href={hit.href}
              className="group flex min-h-[72px] items-center gap-4 py-4"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-amber">
                <Icon name="list" size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium group-hover:text-amber">{hit.title}</span>
                <span className="mt-1 block truncate text-xs text-muted">
                  {hit.byline}
                  {hit.description ? ` · ${hit.description}` : ""}
                </span>
              </span>
              <Icon name="arrow" size={15} className="shrink-0 text-muted/60 group-hover:text-amber" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
