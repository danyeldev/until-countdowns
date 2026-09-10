import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { categoryCounts } from "@/lib/catalog";
import { i18n, localePage } from "@/lib/i18n/server";
import { collectionPage } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/seo";
import { CATEGORY_GROUPS } from "@/lib/taxonomy";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const L = await i18n();
  return buildMetadata({
    locale: L.locale,
    title: L.m.hubs.categoryIndex.title,
    description: L.m.hubs.categoryIndex.description,
    canonical: "/category",
    ogPath: "/og/default",
  });
}

export default async function CategoryIndexPage() {
  const L = await localePage();
  const counts = await categoryCounts();
  return (
    <div>
      <Breadcrumbs
        items={[
          { name: L.m.common.breadcrumb.home, path: "/" },
          { name: L.m.common.nav.categories, path: "/category" },
        ]}
      />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">{L.m.hubs.label.browse}</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">{L.m.hubs.categoryIndex.heading}</h1>
      <p className="mt-4 max-w-2xl text-paper-dim">{L.m.hubs.categoryIndex.intro}</p>

      {CATEGORY_GROUPS.map((group) => {
        // `taxonomy.ts` owns the ids and which categories sit in each; the words are the
        // catalogue's, so a group reads as "Celebrar" without the taxonomy knowing that.
        const words = L.m.categories.groups[group.id as keyof typeof L.m.categories.groups];
        return (
          <section key={group.id} className="mt-12">
            <h2 className="font-serif text-2xl text-paper">{words.label}</h2>
            <p className="mt-1 text-sm text-muted">{words.tagline}</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.categories.map((c) => (
                <li key={c}>
                  <Link href={L.href(`/category/${c}`)} className="ticket flex h-full flex-col gap-1 rounded-2xl p-4 hover:text-amber">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-serif text-lg text-paper">{L.m.categories.labels[c]}</span>
                      <span className="tabular font-mono text-xs text-muted">{L.fmt.number(counts[c] ?? 0)}</span>
                    </span>
                    <span className="text-sm text-paper-dim">{L.m.categories.blurbs[c]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <JsonLd
        data={collectionPage(
          L,
          L.m.common.nav.categories,
          L.m.hubs.categoryIndex.collectionDescription,
          "/category",
          CATEGORY_GROUPS.flatMap((g) => g.categories).map((c) => ({
            name: L.m.categories.labels[c],
            path: `/category/${c}`,
          })),
        )}
      />
    </div>
  );
}
