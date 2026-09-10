import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { allSeries } from "@/lib/catalog";
import { i18n, localePage } from "@/lib/i18n/server";
import { collectionPage } from "@/lib/jsonld";
import { buildMetadata, displayTitle } from "@/lib/seo";
import { CATEGORIES, type Category, type Series } from "@/lib/types";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const L = await i18n();
  return buildMetadata({
    locale: L.locale,
    title: L.m.series.index.title,
    description: L.m.series.index.description,
    canonical: "/days-until",
    ogPath: "/og/default",
  });
}

export default async function SeriesIndexPage() {
  const L = await localePage();
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
      <Breadcrumbs
        items={[
          { name: L.m.common.breadcrumb.home, path: "/" },
          { name: L.m.common.nav.daysUntil, path: "/days-until" },
        ]}
      />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">{L.m.common.labels.recurring}</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">{L.m.series.index.heading}</h1>
      <p className="mt-4 max-w-2xl text-paper-dim">{L.tn(L.m.series.index.intro, list.length)}</p>

      {groups.length === 0 ? (
        <p className="mt-10 text-sm text-muted">{L.m.series.index.empty}</p>
      ) : (
        groups.map((category) => (
          <section key={category} className="mt-12">
            <h2 className="font-serif text-2xl text-paper">
              <Link href={L.href(`/category/${category}`)} className="hover:text-amber">
                {L.m.categories.labels[category]}
              </Link>
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(byCategory.get(category) ?? []).map((s) => (
                <li key={s.slug} className="ticket flex items-baseline justify-between gap-3 rounded-xl px-4 py-3">
                  <Link href={L.href(`/days-until/${s.slug}`)} className="text-paper hover:text-amber">
                    {displayTitle(L, s)}
                  </Link>
                  <span className="tabular whitespace-nowrap font-mono text-xs text-muted">
                    {s.nextDate
                      ? typeof s.daysUntil === "number"
                        ? L.fmt.humanDays(s.daysUntil)
                        : L.fmt.shortDate(s.nextDate)
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <JsonLd
        data={collectionPage(
          L,
          L.m.series.index.title,
          L.m.series.index.jsonLdDescription,
          "/days-until",
          list.slice(0, 100).map((s) => ({ name: displayTitle(L, s), path: `/days-until/${s.slug}` })),
        )}
      />
    </div>
  );
}
