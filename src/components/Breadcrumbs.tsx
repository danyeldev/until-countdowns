import Link from "next/link";
import { i18n } from "@/lib/i18n/server";
import { breadcrumbList, type Crumb } from "@/lib/jsonld";
import { JsonLd } from "./JsonLd";

/**
 * Visible breadcrumb trail plus its BreadcrumbList JSON-LD. The last item is the current page.
 *
 * Crumbs carry app-internal paths (`/category/sports`) and names their page has already translated;
 * the locale goes on the path here, and on the URLs in the JSON-LD, so a page builds one trail
 * whatever language it is rendering in.
 */
export async function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  const L = await i18n();
  return (
    <>
      <nav aria-label={L.m.hubs.breadcrumbLabel} className="text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, i) => {
            const last = i === items.length - 1;
            return (
              <li key={`${item.path}-${i}`} className="flex items-center gap-1.5">
                {i > 0 ? <span aria-hidden="true">/</span> : null}
                {last ? (
                  <span aria-current="page" className="max-w-[16rem] truncate text-paper-dim sm:max-w-md">
                    {item.name}
                  </span>
                ) : (
                  <Link href={L.href(item.path)} className="hover:text-paper">
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbList(L, items)} />
    </>
  );
}
