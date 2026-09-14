import Link from "next/link";

/** `/hub` for page 1, `/hub/page/n` above — pagination lives in the path so page 1 stays ISR. */
export function pageHref(basePath: string, n: number): string {
  return n <= 1 ? basePath : `${basePath}/page/${n}`;
}

/**
 * Previous / Next links for path-paginated hubs, plus `<link rel="prev|next">` (React hoists
 * `<link>` elements rendered anywhere in the tree into `<head>`).
 */
export function Pager({ page, total, pageSize, basePath }: { page: number; total: number; pageSize: number; basePath: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-ink-2 px-4 py-3 text-sm text-paper-dim" aria-label="Pagination">
      {page > 1 ? <link rel="prev" href={pageHref(basePath, page - 1)} /> : null}
      {page < pages ? <link rel="next" href={pageHref(basePath, page + 1)} /> : null}
      <span className="tabular" aria-live="polite">
        Page <span className="font-semibold text-paper">{page}</span> of {pages.toLocaleString("en-US")}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={pageHref(basePath, page - 1)} rel="prev" className="button-secondary">
            <span aria-hidden="true">←</span> Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={pageHref(basePath, page + 1)} rel="next" className="button-secondary">
            Next <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
