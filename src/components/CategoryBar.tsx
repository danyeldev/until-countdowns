import Link from "next/link";
import type { Localized } from "@/lib/i18n/bind";
import type { Category } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";

export function CategoryBar({
  L,
  active,
  counts,
  q,
  sort,
}: {
  L: Localized;
  active?: string;
  counts: Partial<Record<Category, number>>;
  q?: string;
  sort?: string;
}) {
  const base = new URLSearchParams();
  if (q) base.set("q", q);
  if (sort) base.set("sort", sort);

  // Without a free-text query the category filter is a hub page of its own (`/?category=x`
  // 308s there anyway); with a query it narrows the search on the home page.
  function href(category?: string) {
    if (!q && category) return L.href(`/category/${category}`);
    const p = new URLSearchParams(base);
    if (category) p.set("category", category);
    const s = p.toString();
    return L.href(s ? `/?${s}` : "/");
  }

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      <Link
        href={href()}
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.14em] ${
          !active || active === "all"
            ? "bg-paper text-ink"
            : "border border-line text-paper-dim hover:text-paper"
        }`}
      >
        {L.m.home.filters.all}
      </Link>
      {CATEGORIES.filter((c) => (counts[c] ?? 0) > 0).map((c) => (
        <Link
          key={c}
          href={href(c)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.14em] ${
            active === c ? "bg-paper text-ink" : "border border-line text-paper-dim hover:text-paper"
          }`}
        >
          {L.m.categories.labels[c]}
          <span className="ms-2 opacity-60">{L.fmt.number(counts[c] ?? 0)}</span>
        </Link>
      ))}
    </div>
  );
}
