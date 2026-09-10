import Link from "next/link";
import { i18n } from "@/lib/i18n/server";

/**
 * `/hub` for page 1, `/hub/page/n` above — pagination lives in the path so page 1 stays ISR.
 * App-internal, like every other path in the app: the locale is put on it where it is rendered.
 */
export function pageHref(basePath: string, n: number): string {
  return n <= 1 ? basePath : `${basePath}/page/${n}`;
}

/**
 * Previous / Next links for path-paginated hubs, plus `<link rel="prev|next">` (React hoists
 * `<link>` elements rendered anywhere in the tree into `<head>`). Reads the locale itself, so a hub
 * hands it the same app-internal `basePath` it uses for its breadcrumbs.
 */
export async function Pager({ page, total, pageSize, basePath }: { page: number; total: number; pageSize: number; basePath: string }) {
  const L = await i18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-between text-sm text-paper-dim" aria-label={L.m.home.pagination}>
      {page > 1 ? <link rel="prev" href={L.href(pageHref(basePath, page - 1))} /> : null}
      {page < pages ? <link rel="next" href={L.href(pageHref(basePath, page + 1))} /> : null}
      <span className="tabular">
        {L.t(L.m.common.pagination.pageOf, { n: L.fmt.number(page), total: L.fmt.number(pages) })}
      </span>
      <div className="flex gap-4">
        {page > 1 ? (
          <Link href={L.href(pageHref(basePath, page - 1))} rel="prev" className="hover:text-paper">
            {L.m.common.pagination.previous}
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={L.href(pageHref(basePath, page + 1))} rel="next" className="hover:text-paper">
            {L.m.common.pagination.next}
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
