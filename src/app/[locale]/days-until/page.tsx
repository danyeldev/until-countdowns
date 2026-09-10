import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { allSeries } from "@/lib/catalog";
import { collectionPage } from "@/lib/jsonld";
import { CATEGORY_LABELS } from "@/lib/labels";
import { buildMetadata, formatShortDate } from "@/lib/seo";
import { humanDays } from "@/lib/time";
import { CATEGORIES, type Category, type Series } from "@/lib/types";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Days until — every recurring countdown",
  description:
    "Christmas, Ramadan, the Super Bowl, the Perseids: every recurring date in the catalog with the next occurrence on top and a table of the years to come.",
  canonical: "/days-until",
  ogPath: "/og/default",
});

export default async function SeriesIndexPage() {
  const list = await allSeries();
  const byCategory = new Map<Category, Series[]>();
  for (const s of list) {
    const bucket = byCategory.get(s.category) ?? [];
    bucket.push(s);
    byCategory.set(s.category, bucket);
  }
  const groups = CATEGORIES.filter((c) => (byCategory.get(c)?.length ?? 0) > 0);

  return (
    <div>
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Days until", path: "/days-until" }]} />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">Recurring</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">How many days until…</h1>
      <p className="mt-4 max-w-2xl text-paper-dim">
        {list.length.toLocaleString("en-US")} dates that come back every year. Each page keeps the next occurrence
        on top and lists the years to come.
      </p>

      {groups.length === 0 ? (
        <p className="mt-10 text-sm text-muted">The catalog is being filled — check back soon.</p>
      ) : (
        groups.map((category) => (
          <section key={category} className="mt-12">
            <h2 className="font-serif text-2xl text-paper">
              <Link href={`/category/${category}`} className="hover:text-amber">
                {CATEGORY_LABELS[category]}
              </Link>
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(byCategory.get(category) ?? []).map((s) => (
                <li key={s.slug} className="ticket flex items-baseline justify-between gap-3 rounded-xl px-4 py-3">
                  <Link href={`/days-until/${s.slug}`} className="text-paper hover:text-amber">
                    {s.title}
                  </Link>
                  <span className="tabular whitespace-nowrap font-mono text-xs text-muted">
                    {s.nextDate ? (typeof s.daysUntil === "number" ? humanDays(s.daysUntil) : formatShortDate(s.nextDate)) : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <JsonLd
        data={collectionPage(
          "Days until — every recurring countdown",
          "Recurring dates with the next occurrence and a multi-year table.",
          "/days-until",
          list.slice(0, 100).map((s) => ({ name: s.title, path: `/days-until/${s.slug}` })),
        )}
      />
    </div>
  );
}
