import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon, type IconName } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { categoryCounts } from "@/lib/catalog";
import { collectionPage } from "@/lib/jsonld";
import { CATEGORY_BLURB, CATEGORY_LABELS } from "@/lib/labels";
import { localizedMetadata } from "@/lib/seo";
import { CATEGORY_GROUPS } from "@/lib/taxonomy";

export const revalidate = 3600;
const GROUP_ICONS: Record<string, IconName> = { celebrate: "spark", watch: "film", play: "bolt", "look-up": "moon", vote: "globe", wonder: "compass" };

export async function generateMetadata() {
  return localizedMetadata({
  title: "Categories — every kind of date that has not happened yet",
  description:
    "Browse upcoming dates by category: holidays, sports, film and TV, games, space, elections, anniversaries and more, each with live countdowns.",
  canonical: "/category",
  ogPath: "/og/default",
});
}

export default async function CategoryIndexPage() {
  const counts = await categoryCounts();
  return (
    <div>
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Categories", path: "/category" }]} />
      <p className="eyebrow mt-7">Browse</p>
      <h1 className="page-heading mt-3">Every kind of date</h1>
      <p className="page-subtitle mt-3 max-w-2xl">Find your next obsession. Explore holidays, releases, discoveries and everything in between.</p>

      <nav aria-label="Category groups" className="mt-7 flex flex-wrap gap-1">
        {CATEGORY_GROUPS.map((group) => <a key={group.id} href={`#${group.id}`} className="chip bg-surface"><Icon name={GROUP_ICONS[group.id]} size={16} />{group.label}</a>)}
      </nav>
      {CATEGORY_GROUPS.map((group) => (
        <section key={group.id} id={group.id} className="mt-14 scroll-mt-28">
          <h2 className="section-heading flex items-center gap-3 text-paper"><Icon name={GROUP_ICONS[group.id]} size={22} className="text-amber" />{group.label}</h2>
          <p className="mt-1 text-sm text-muted">{group.tagline}</p>
          <ul className="mt-4 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {group.categories.map((c) => (
              <li key={c} className="border-t border-line">
                <Link href={`/category/${c}`} className="group flex h-full flex-col gap-2 py-5">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-[17px] font-semibold text-paper group-hover:text-amber">{CATEGORY_LABELS[c]}</span>
                    <span className="tabular shrink-0 text-xs text-muted">{(counts[c] ?? 0).toLocaleString("en-US")}</span>
                  </span>
                  <span className="text-sm leading-relaxed text-muted">{CATEGORY_BLURB[c]}</span>
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
