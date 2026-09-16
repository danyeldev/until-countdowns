import Link from "next/link";
import { EventCard } from "./EventCard";
import { CategoryBar } from "./CategoryBar";
import { CollectionSearchHits } from "./CollectionSearchHits";
import { Icon } from "./Icon";
import { CATEGORY_LABELS } from "@/lib/labels";
import type { CollectionSearchHit } from "@/lib/search-collections";
import {
  DEFAULT_EVENT_SORT,
  type Category,
  type CountdownEvent,
  type SeriesOccurrencePreview,
} from "@/lib/types";

/**
 * A search that found nothing used to be a full stop: one grey sentence, and a page whose browsing
 * sections are all gated behind the unfiltered hub. It hands back the busiest categories instead,
 * so there is somewhere to go from here.
 */
function EmptyResult({
  q,
  counts,
}: {
  q?: string;
  counts: Partial<Record<Category, number>>;
}) {
  const busiest = (Object.entries(counts) as [Category, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="empty-state mt-6">
      <p className="text-lg text-paper">
        {q ? (
          <>Nothing in the catalog matches “{q}”.</>
        ) : (
          <>Nothing here yet.</>
        )}
      </p>
      <p className="mt-2 text-sm text-muted">
        Try a shorter search, a different spelling, or explore one of the
        categories below. You can also make your own countdown for any date.
      </p>
      {busiest.length > 0 && (
        <>
          <p className="mt-8 text-xs uppercase tracking-[0.16em] text-muted">
            Busiest categories
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {busiest.map(([c, n]) => (
              <li key={c}>
                <Link
                  href={`/category/${c}`}
                  className="inline-flex items-baseline gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-paper-dim hover:border-amber/50 hover:text-paper"
                >
                  {CATEGORY_LABELS[c]}
                  <span className="tabular font-mono text-[10px] text-muted">
                    {n.toLocaleString("en-US")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-6 text-sm">
        <Link
          href="/days-until"
          className="text-amber underline hover:text-paper"
        >
          Every recurring date
        </Link>
        {" · "}
        <Link href="/" className="text-amber underline hover:text-paper">
          Start over
        </Link>
      </p>
    </div>
  );
}

export function CatalogExplorer({
  events,
  total,
  page,
  pageSize,
  q,
  category,
  sort,
  counts,
  showSearch = true,
  futureOccurrences = {},
  collections = [],
}: {
  events: CountdownEvent[];
  total: number;
  page: number;
  pageSize: number;
  q?: string;
  category?: string;
  sort?: string;
  counts: Partial<Record<Category, number>>;
  showSearch?: boolean;
  futureOccurrences?: Record<string, SeriesOccurrencePreview[]>;
  collections?: CollectionSearchHit[];
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(next: number) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (category && category !== "all") p.set("category", category);
    if (sort && sort !== DEFAULT_EVENT_SORT) p.set("sort", sort);
    if (next > 1) p.set("page", String(next));
    const s = p.toString();
    return s ? `/?${s}#explore` : "/#explore";
  }

  function sortHref(next: string) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (category && category !== "all") p.set("category", category);
    if (next !== DEFAULT_EVENT_SORT) p.set("sort", next);
    return `/${p.size ? `?${p}` : ""}#explore`;
  }

  return (
    <section id="explore" className={q ? "mt-6" : "mt-9"}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={q ? "sr-only" : "section-heading"}>
            {q ? "Matching countdowns" : "Discover countdowns"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {!q && (sort || DEFAULT_EVENT_SORT) === "hot"
              ? "A blend of soon, well-known, and live hype. "
              : !q && sort === "hype"
                ? "Live attention first. "
                : ""}
            {q && collections.length && total === 0 ? (
              <>
                {collections.length} collection
                {collections.length === 1 ? "" : "s"}
              </>
            ) : (
              <>
                {total.toLocaleString("en-US")}{" "}
                {q
                  ? total === 1
                    ? "result"
                    : "results"
                  : total === 1
                    ? "upcoming date"
                    : "upcoming dates"}
              </>
            )}
            {category && category !== "all" ? (
              <>
                {" in "}
                <Link
                  href={`/category/${category}`}
                  className="underline hover:text-paper"
                >
                  {category}
                </Link>
              </>
            ) : null}
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1 rounded-xl border border-line bg-ink-2 p-1 text-xs">
          {[
            ["soonest", "Soonest"],
            ["hot", "Hot"],
            ["hype", "Hype"],
            ["latest", "Furthest"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={sortHref(value)}
              aria-current={(sort || DEFAULT_EVENT_SORT) === value ? "true" : undefined}
              className={`inline-flex min-h-10 items-center rounded-lg px-3 py-2 ${
                (sort || DEFAULT_EVENT_SORT) === value
                  ? "bg-amber/15 text-amber"
                  : "text-paper-dim hover:text-amber"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {showSearch && (
        <form
          action="/"
          className="mt-6 flex items-center gap-3 rounded-full border border-line bg-ink-2 p-2 pl-4"
        >
          <Icon name="search" className="text-muted" />
          <label htmlFor="catalog-search" className="sr-only">
            Search countdowns
          </label>
          <input
            id="catalog-search"
            key={q ?? ""}
            type="search"
            name="q"
            maxLength={80}
            defaultValue={q}
            placeholder="Search the whole catalog…"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm tracking-normal outline-none placeholder:text-muted"
          />
          {category && <input type="hidden" name="category" value={category} />}
          <button className="button-primary !rounded-full" type="submit">
            Search
          </button>
        </form>
      )}
      {(q || category) && (
        <Link
          href="/#explore"
          className="mt-3 inline-flex items-center gap-1 text-xs text-amber"
        >
          <Icon name="close" size={13} />
          Clear filters
        </Link>
      )}
      <div className="mt-6">
        <CategoryBar active={category} counts={counts} q={q} sort={sort} />
      </div>
      {q &&
        events.some(
          (event) => event.seriesSlug && futureOccurrences[event.id]?.length,
        ) && (
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Expand More years on recurring events to explore later dates.
          </p>
        )}

      {q && collections.length ? (
        <div className="mt-6">
          <CollectionSearchHits hits={collections} />
        </div>
      ) : null}

      {events.length === 0 ? (
        collections.length ? null : <EmptyResult q={q} counts={counts} />
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              showSeriesLink
              futureOccurrences={futureOccurrences[event.id]}
            />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div
          role="navigation"
          aria-label="Search pagination"
          className="mt-8 flex items-center justify-between border-t border-line pt-6 text-sm text-paper-dim"
        >
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-3">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="button-secondary">
                ← Previous
              </Link>
            )}
            {page < pages && (
              <Link href={pageHref(page + 1)} className="button-secondary">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
