import Link from "next/link";
import type { Category } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
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
  if (sort) base.set("sort", sort);

  function href(category?: string) {
    const p = new URLSearchParams(base);
    if (category) p.set("category", category);
    const s = p.toString();
    return s ? `/?${s}` : "/";
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
        All
      </Link>
      {CATEGORIES.filter((c) => (counts[c] ?? 0) > 0).map((c) => (
        <Link
          key={c}
          href={href(c)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.14em] ${
            active === c ? "bg-paper text-ink" : "border border-line text-paper-dim hover:text-paper"
          }`}
        >
          {CATEGORY_LABELS[c]}
          <span className="ml-2 opacity-60">{counts[c]}</span>
        </Link>
      ))}
    </div>
  );
}
