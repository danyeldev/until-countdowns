import Link from "next/link";
import type { CollectionSearchHit } from "@/lib/search-collections";
import { Icon } from "./Icon";

export function CollectionSearchHits({ hits }: { hits: CollectionSearchHit[] }) {
  if (!hits.length) return null;
  return (
    <section>
      <h2 className="section-heading">Collections</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {hits.map((hit) => (
          <li key={hit.id}>
            <Link
              href={hit.href}
              className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-line bg-ink-2 px-5 py-4 hover:border-amber/40"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber/10 text-amber">
                <Icon name="list" size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{hit.title}</span>
                <span className="mt-1 block truncate text-xs text-muted">
                  {hit.byline}
                  {hit.description ? ` · ${hit.description}` : ""}
                </span>
              </span>
              <Icon name="arrow" size={15} className="shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
