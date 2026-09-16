import { Link } from "@/i18n/navigation";
import type { Category } from "@/lib/types";
import { CATEGORIES, DEFAULT_EVENT_SORT } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/labels";

export function CategoryBar({
  active,
  counts,
  q,
  sort,
}: {
  active?: string;
  counts: Partial<Record<Category, number>>;
  q?: string;
  sort?: string;
}) {
  const base = new URLSearchParams();
  if (q) base.set("q", q);
  if (sort && sort !== DEFAULT_EVENT_SORT) base.set("sort", sort);

  // Without a free-text query the category filter is a hub page of its own (`/?category=x`
  // 308s there anyway); with a query it narrows the search on the home page.
  function href(category?: string) {
    if (!q && category) return `/category/${category}`;
    const p = new URLSearchParams(base);
    if (category) p.set("category", category);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
      <Link
        href={href()}
        aria-current={!active || active === "all" ? "true" : undefined}
        className={`shrink-0 inline-flex min-h-11 items-center rounded-full px-4 py-2 text-xs ${
          !active || active === "all"
            ? "border border-amber/40 bg-amber/15 text-amber"
            : "border border-line bg-ink-2 text-paper-dim hover:border-amber hover:text-amber"
        }`}
      >
        All
      </Link>
      {CATEGORIES.filter((c) => (counts[c] ?? 0) > 0).map((c) => (
        <Link
          key={c}
          href={href(c)}
          aria-current={active === c ? "true" : undefined}
          className={`shrink-0 inline-flex min-h-11 items-center rounded-full px-4 py-2 text-xs ${
            active === c
              ? "border border-amber/40 bg-amber/15 text-amber"
              : "border border-line bg-ink-2 text-paper-dim hover:border-amber hover:text-amber"
          }`}
        >
          {CATEGORY_LABELS[c]}
          {!q && (
            <span className="ml-2 font-mono text-[10px]">
              {counts[c]?.toLocaleString("en-US")}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
