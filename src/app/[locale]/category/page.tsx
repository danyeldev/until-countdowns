import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { categoryCounts } from "@/lib/catalog";
import { collectionPage } from "@/lib/jsonld";
import { CATEGORY_BLURB, CATEGORY_LABELS } from "@/lib/labels";
import { buildMetadata } from "@/lib/seo";
import { CATEGORY_GROUPS } from "@/lib/taxonomy";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "Categories — every kind of date that has not happened yet",
  description:
    "Browse upcoming dates by category: holidays, sports, film and TV, games, space, elections, anniversaries and more, each with live countdowns.",
  canonical: "/category",
  ogPath: "/og/default",
});

export default async function CategoryIndexPage() {
  const counts = await categoryCounts();
  return (
    <div>
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Categories", path: "/category" }]} />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">Browse</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">Every kind of date</h1>
      <p className="mt-4 max-w-2xl text-paper-dim">Twenty-three categories, grouped by what you would do with them.</p>

      {CATEGORY_GROUPS.map((group) => (
        <section key={group.id} className="mt-12">
          <h2 className="font-serif text-2xl text-paper">{group.label}</h2>
          <p className="mt-1 text-sm text-muted">{group.tagline}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.categories.map((c) => (
              <li key={c}>
                <Link href={`/category/${c}`} className="ticket flex h-full flex-col gap-1 rounded-2xl p-4 hover:text-amber">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-serif text-lg text-paper">{CATEGORY_LABELS[c]}</span>
                    <span className="tabular font-mono text-xs text-muted">{(counts[c] ?? 0).toLocaleString("en-US")}</span>
                  </span>
                  <span className="text-sm text-paper-dim">{CATEGORY_BLURB[c]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <JsonLd
        data={collectionPage(
          "Categories",
          "Upcoming dates by category.",
          "/category",
          CATEGORY_GROUPS.flatMap((g) => g.categories).map((c) => ({ name: CATEGORY_LABELS[c], path: `/category/${c}` })),
        )}
      />
    </div>
  );
}
