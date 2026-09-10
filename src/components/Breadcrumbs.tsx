import Link from "next/link";
import { JsonLd } from "./JsonLd";
import { breadcrumbList, type Crumb } from "@/lib/jsonld";

/** Visible breadcrumb trail plus its BreadcrumbList JSON-LD. The last item is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
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
                  <Link href={item.path} className="hover:text-paper">
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
