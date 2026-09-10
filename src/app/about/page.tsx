import type { Metadata } from "next";
import { catalogMeta } from "@/lib/catalog";
import { CATEGORY_LABELS, sourceLabel } from "@/lib/labels";
import { buildMetadata } from "@/lib/seo";
import type { Category } from "@/lib/types";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "About",
  description: "How Until collects, tags, and classifies thousands of future dates.",
  canonical: "/about",
  ogPath: "/og/default",
});

export default async function AboutPage() {
  const meta = await catalogMeta();
  const cats = Object.entries(meta.stats.byCat).sort((a, b) => b[1] - a[1]);
  const srcs = Object.entries(meta.stats.bySrc).sort((a, b) => b[1] - a[1]);
  const updated = meta.generatedAt ? meta.generatedAt.slice(0, 10) : "—";

  return (
    <article className="max-w-2xl">
      <p className="text-[11px] uppercase tracking-[0.24em] text-amber">The project</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">A newspaper of the future</h1>
      <div className="mt-8 space-y-5 text-paper-dim leading-relaxed">
        <p>
          Until is a catalog of dates that have not happened yet. Public holidays from nearly every country, scheduled
          events drawn from Wikipedia year pages and Wikidata, plus a curated layer of the ones people actually wait
          for — eclipses, World Cups, Olympics, elections, Halley&apos;s Comet.
        </p>
        <p>
          Each row is tagged and classified across {Object.keys(CATEGORY_LABELS).length} categories — holidays,
          national days, sports, astronomy, space, tech, politics, history, and more. Search the whole set, filter a
          category, open a live countdown, and add it to a calendar.
        </p>
        <p>
          The holiday backbone is the offline{" "}
          <a className="underline" href="https://github.com/commenthol/date-holidays" target="_blank" rel="noreferrer">
            date-holidays
          </a>{" "}
          dataset, extended with{" "}
          <a className="underline" href="https://www.wikidata.org/" target="_blank" rel="noreferrer">
            Wikidata
          </a>{" "}
          and{" "}
          <a className="underline" href="https://en.wikipedia.org/" target="_blank" rel="noreferrer">
            Wikipedia
          </a>
          . Duplicate names on the same day (Christmas in 140 countries) are merged into one countdown. When sources
          disagree, curated records win. Every event page names its source and when the date was last verified.
        </p>
        <p>
          Dates without a confirmed day are labelled &ldquo;expected&rdquo; with the month, quarter, or year the
          source gives, and they do not tick until a real date is published. The catalog refreshes daily from its
          sources.
        </p>
        <p>
          You can make your own. Those stay in the browser — no account — and the share link carries the title and date
          in the URL so anyone can open the same ticking clock.
        </p>
      </div>

      <dl className="mt-12 grid gap-6 sm:grid-cols-3">
        <div className="ticket rounded-2xl p-5">
          <dt className="text-xs uppercase tracking-[0.16em] text-muted">Dates</dt>
          <dd className="mt-2 font-mono text-3xl text-amber">{meta.count.toLocaleString()}</dd>
        </div>
        <div className="ticket rounded-2xl p-5">
          <dt className="text-xs uppercase tracking-[0.16em] text-muted">Featured</dt>
          <dd className="mt-2 font-mono text-3xl text-amber">{meta.stats.featured.toLocaleString()}</dd>
        </div>
        <div className="ticket rounded-2xl p-5">
          <dt className="text-xs uppercase tracking-[0.16em] text-muted">Updated</dt>
          <dd className="mt-2 font-mono text-sm text-paper-dim">{updated}</dd>
        </div>
      </dl>

      <h2 className="mt-12 font-serif text-2xl text-paper">By category</h2>
      {cats.length === 0 ? (
        <p className="mt-4 text-sm text-muted">The catalog is being filled — check back soon.</p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm">
          {cats.map(([name, n]) => (
            <li key={name} className="flex justify-between border-b border-line/60 py-1.5">
              <span className="text-paper-dim">{CATEGORY_LABELS[name as Category] ?? name}</span>
              <span className="font-mono text-muted">{n.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-12 font-serif text-2xl text-paper">By source</h2>
      {srcs.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No sources reported yet.</p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm">
          {srcs.map(([name, n]) => (
            <li key={name} className="flex justify-between border-b border-line/60 py-1.5">
              <span className="text-paper-dim">{sourceLabel(name, meta.sourceLabels)}</span>
              <span className="font-mono text-muted">{n.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
