import { Link } from "@/i18n/navigation";
import { EventCard } from "./EventCard";
import { CategoryBar } from "./CategoryBar";
import { CollectionSearchHits } from "./CollectionSearchHits";
import { CatalogSearchForm } from "./CatalogSearchForm";
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
          <p className="eyebrow mt-8">Busiest categories</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {busiest.map(([c, n]) => (
              <li key={c}>
                <Link
                  href={`/category/${c}`}
                  className="chip bg-surface"
                >
                  {CATEGORY_LABELS[c]}
                  <span className="tabular text-[11px] text-muted">
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
        <div className="segmented shrink-0">
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
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {showSearch && <CatalogSearchForm q={q} category={category} />}
      {(q || category) && (
        <Link
          href="/#explore"
          className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm text-amber hover:text-paper"
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
        <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
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
          className="hairline mt-12 flex items-center justify-between pt-6 text-sm text-paper-dim"
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
