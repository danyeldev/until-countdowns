"use client";

import { useLocale, useTranslations } from "next-intl";
import { localizePath } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";

/** `/hub` for page 1, `/hub/page/n` above — pagination lives in the path so page 1 stays ISR. */
export function pageHref(basePath: string, n: number): string {
  return n <= 1 ? basePath : `${basePath}/page/${n}`;
}

/**
 * Previous / Next links for path-paginated hubs, plus `<link rel="prev|next">` (React hoists
 * `<link>` elements rendered anywhere in the tree into `<head>`).
 */
export function Pager({ page, total, pageSize, basePath }: { page: number; total: number; pageSize: number; basePath: string }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="hairline mt-10 flex flex-wrap items-center justify-between gap-4 pt-6 text-sm text-paper-dim" aria-label={t("pagination")}>
      {page > 1 ? <link rel="prev" href={localizePath(pageHref(basePath, page - 1), locale)} /> : null}
      {page < pages ? <link rel="next" href={localizePath(pageHref(basePath, page + 1), locale)} /> : null}
      <span className="tabular" aria-live="polite">
        {t("pageOf", { page, pages })}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={pageHref(basePath, page - 1)} rel="prev" className="button-secondary">
            <span aria-hidden="true">←</span> {t("previous")}
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={pageHref(basePath, page + 1)} rel="next" className="button-secondary">
            {t("next")} <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
