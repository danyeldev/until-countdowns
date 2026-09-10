import Link from "next/link";
import { EventCard } from "./EventCard";
import { CategoryBar } from "./CategoryBar";
import type { Category, CountdownEvent } from "@/lib/types";

export function CatalogExplorer({
  events,
  total,
  page,
  pageSize,
  q,
  category,
  sort,
  counts,
}: {
  events: CountdownEvent[];
  total: number;
  page: number;
  pageSize: number;
  q?: string;
  category?: string;
  sort?: string;
  counts: Partial<Record<Category, number>>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(next: number) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (category && category !== "all") p.set("category", category);
    if (sort) p.set("sort", sort);
    if (next > 1) p.set("page", String(next));
    const s = p.toString();
    return s ? `/?${s}` : "/";
  }

  function sortHref(next: string) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (category && category !== "all") p.set("category", category);
    if (next !== "soonest") p.set("sort", next);
    return `/?${p.toString()}`;
  }

  return (
    <section className="mt-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-3xl text-paper">The catalog</h2>
          <p className="mt-1 text-sm text-muted">
            {total.toLocaleString()} upcoming dates
            {q ? ` matching “${q}”` : ""}
            {category && category !== "all" ? (
              <>
                {" in "}
                <Link href={`/category/${category}`} className="underline hover:text-paper">
                  {category}
                </Link>
              </>
            ) : null}
            .
          </p>
        </div>
        <div className="flex gap-2 text-xs uppercase tracking-[0.14em]">
          {[
            ["soonest", "Soonest"],
            ["popular", "Popular"],
            ["latest", "Furthest"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={sortHref(value)}
              className={`rounded-full px-3 py-1.5 ${
                (sort || "soonest") === value
                  ? "bg-paper text-ink"
                  : "border border-line text-paper-dim hover:text-paper"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <CategoryBar active={category} counts={counts} q={q} sort={sort} />
      </div>

      {events.length === 0 ? (
        <p className="mt-12 text-paper-dim">Nothing matches. Try another category or a shorter search.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-10 flex items-center justify-between text-sm text-paper-dim">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-3">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="hover:text-paper">
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={pageHref(page + 1)} className="hover:text-paper">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
