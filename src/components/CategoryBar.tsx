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

  const allActive = !active || active === "all";
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      <Link href={href()} aria-current={allActive ? "true" : undefined} className="chip shrink-0">
        All
      </Link>
      {CATEGORIES.filter((c) => (counts[c] ?? 0) > 0).map((c) => (
        <Link
          key={c}
          href={href(c)}
          aria-current={active === c ? "true" : undefined}
          className="chip shrink-0"
        >
          {CATEGORY_LABELS[c]}
          {!q && (
            <span className={`tabular text-[11px] ${active === c ? "text-ink/60" : "text-muted"}`}>
              {counts[c]?.toLocaleString("en-US")}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
