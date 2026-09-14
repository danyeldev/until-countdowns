import Link from "next/link";
import { JsonLd } from "./JsonLd";
import { breadcrumbList, type Crumb } from "@/lib/jsonld";

/** Visible breadcrumb trail plus its BreadcrumbList JSON-LD. The last item is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-xs text-muted sm:text-sm">
        <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          {items.map((item, i) => {
            const last = i === items.length - 1;
            return (
              <li
                key={`${item.path}-${i}`}
                className="flex min-w-0 items-center gap-2"
              >
                {i > 0 ? (
                  <span aria-hidden="true" className="text-muted">
                    ›
                  </span>
                ) : null}
                {last ? (
                  <span
                    aria-current="page"
                    className="max-w-[16rem] truncate py-2 text-paper-dim sm:max-w-md"
                  >
                    {item.name}
                  </span>
                ) : (
                  <Link
                    href={item.path}
                    className="inline-flex min-h-11 items-center rounded-md hover:text-paper"
                  >
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbList(items)} />
    </>
  );
}
