import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { Icon } from "@/components/Icon";
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
      <p className="eyebrow mt-7">Recurring</p>
      <h1 className="page-heading mt-3">How many days until…</h1>
      <p className="page-subtitle mt-3 max-w-2xl">
        {list.length.toLocaleString("en-US")} moments worth coming back to. Find the next date,
        then explore the years ahead.
      </p>
      <nav className="mt-7 flex flex-wrap gap-2" aria-label="Recurring countdown categories">
        {groups.map((category) => <a key={category} href={`#recurring-${category}`} className="button-secondary">{CATEGORY_LABELS[category]} <span className="text-muted">{byCategory.get(category)?.length}</span></a>)}
      </nav>

      {groups.length === 0 ? (
        <div className="empty-state mt-10"><Icon name="calendar" size={28} /><h2 className="section-heading mt-4">More dates on the way</h2><p className="mt-2 text-paper-dim">Explore the latest events while recurring dates are being added.</p><Link href="/" className="button-primary mt-5">Explore countdowns</Link></div>
      ) : (
        groups.map((category) => (
          <section key={category} id={`recurring-${category}`} className="mt-12 scroll-mt-28">
            <h2 className="section-heading text-paper">
              <Link href={`/category/${category}`} className="hover:text-amber">
                {CATEGORY_LABELS[category]}
              </Link>
            </h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(byCategory.get(category) ?? []).map((s) => (
                <li key={s.slug}>
                  <Link href={`/days-until/${s.slug}`} className="ticket group flex h-full min-h-40 flex-col rounded-2xl p-5">
                    <span className="flex items-start justify-between gap-3"><span className="text-lg font-semibold leading-snug text-paper group-hover:text-amber">{s.title}</span><Icon name="arrow" className="mt-1 shrink-0 text-muted group-hover:text-amber" /></span>
                    <span className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-6">
                      <span className="text-sm text-muted">{s.nextDate ? formatShortDate(s.nextDate, s.nextTimezone) : "Next date to be announced"}</span>
                      {typeof s.daysUntil === "number" ? <span className="tabular text-lg font-semibold text-amber">{humanDays(s.daysUntil)}</span> : null}
                    </span>
                  </Link>
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
