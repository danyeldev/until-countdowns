import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/Icon";
import { catalogMeta } from "@/lib/catalog";
import { CATEGORY_LABELS, sourceLabel } from "@/lib/labels";
import { localizedMetadata } from "@/lib/seo";
import type { Category } from "@/lib/types";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return localizedMetadata({
    title: "About",
    description: "How Until collects, tags, and classifies thousands of future dates.",
    canonical: "/about",
    ogPath: "/og/default",
    locale,
  });
}

export default async function AboutPage() {
  const meta = await catalogMeta();
  const cats = Object.entries(meta.stats.byCat).sort((a, b) => b[1] - a[1]);
  const srcs = Object.entries(meta.stats.bySrc).sort((a, b) => b[1] - a[1]);
  const updated = meta.generatedAt ? meta.generatedAt.slice(0, 10) : "—";

  return (
    <article>
      <p className="eyebrow">
        The project
      </p>
      <h1 className="page-heading mt-3">
        Make room for what’s next.
      </h1>
      <p className="page-subtitle mt-4 max-w-2xl">
        The next eclipse. A much-awaited release. A day that means something to you.
        Until brings the dates worth looking forward to into one place.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/" className="button-primary">Find your next moment <Icon name="arrow" /></Link>
        <Link href="/create" className="button-secondary"><Icon name="plus" /> Make your own</Link>
      </div>

      <dl className="mt-14 grid gap-8 sm:grid-cols-3">
        <div className="border-t border-line pt-4">
          <dt className="text-sm text-muted">
            Dates
          </dt>
          <dd className="tabular mt-2 text-4xl font-semibold tracking-tight text-amber">
            {meta.count.toLocaleString()}
          </dd>
        </div>
        <div className="border-t border-line pt-4">
          <dt className="text-sm text-muted">
            Featured
          </dt>
          <dd className="tabular mt-2 text-4xl font-semibold tracking-tight text-amber">
            {meta.stats.featured.toLocaleString()}
          </dd>
        </div>
        <div className="border-t border-line pt-4">
          <dt className="text-sm text-muted">
            Updated
          </dt>
          <dd className="tabular mt-2 text-lg font-medium text-paper-dim">{updated}</dd>
        </div>
      </dl>

      <div className="mt-16 grid gap-12 lg:grid-cols-2 lg:gap-16">
        <section>
          <Icon name="compass" className="text-amber" size={26} />
          <h2 className="section-heading mt-5">Discover, then make it yours</h2>
          <div className="mt-4 space-y-4 leading-relaxed text-paper-dim">
            <p>Explore {Object.keys(CATEGORY_LABELS).length} categories, from public holidays and sport to astronomy, film and games. Save a countdown, add it to a calendar, or look through the years ahead.</p>
            <p>Create a personal countdown for a birthday, trip or something only you understand. Sign in to keep your collection with your account. A share link carries the title, date and note so others can open the same countdown.</p>
          </div>
        </section>
        <section>
          <Icon name="check" className="text-amber" size={26} />
          <h2 className="section-heading mt-5">Dates with a source</h2>
          <div className="mt-4 space-y-4 leading-relaxed text-paper-dim">
            <p>The catalog combines public datasets, specialist calendars and curated records. Event pages name their sources and show verification dates when available. Matching records are reconciled so the same occasion is easier to find.</p>
            <p>An unconfirmed day is marked “expected,” with the month, quarter or year its source gives. Refresh schedules follow each source, and the last known information is retained when a source is unavailable.</p>
          </div>
          <Link href="/attributions" className="button-secondary mt-5">Meet the sources <Icon name="arrow" /></Link>
        </section>
      </div>
      <div className="mt-16 grid gap-12 lg:grid-cols-2 lg:gap-16">
        <section>
          <h2 className="section-heading">Inside the catalog</h2>
          {cats.length === 0 ? <p className="mt-4 text-muted">Category totals will appear as dates are added.</p> : (
            <ul className="mt-4 divide-y divide-line text-sm">
              {cats.map(([name, n]) => <li key={name}><Link href={`/category/${name}`} className="flex min-h-11 items-center justify-between gap-3 py-3 text-paper-dim hover:text-amber"><span>{CATEGORY_LABELS[name as Category] ?? name}</span><span className="tabular text-muted">{n.toLocaleString("en-US")}</span></Link></li>)}
            </ul>
          )}
        </section>
        <section>
          <h2 className="section-heading">Built on open data</h2>
          {srcs.length === 0 ? <p className="mt-4 text-muted">Source totals will appear as dates are added.</p> : (
            <ul className="mt-4 divide-y divide-line text-sm">
              {srcs.map(([name, n]) => <li key={name} className="flex min-h-11 items-center justify-between gap-3 py-3"><span className="text-paper-dim">{sourceLabel(name, meta.sourceLabels)}</span><span className="tabular text-muted">{n.toLocaleString("en-US")}</span></li>)}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}
