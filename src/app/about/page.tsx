import { catalogMeta } from "@/lib/catalog";

export const metadata = {
  title: "About",
  description: "How Until collects, tags, and classifies thousands of future dates.",
};

export default function AboutPage() {
  const meta = catalogMeta();
  const cats = Object.entries(meta.stats.byCat).sort((a, b) => b[1] - a[1]);
  const srcs = Object.entries(meta.stats.bySrc).sort((a, b) => b[1] - a[1]);

  return (
    <article className="max-w-2xl">
      <p className="text-[11px] uppercase tracking-[0.24em] text-amber">The project</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">A newspaper of the future</h1>
      <div className="mt-8 space-y-5 text-paper-dim leading-relaxed">
        <p>
          Until is a catalog of dates that have not happened yet. Public holidays from nearly every country, scheduled
          events scraped from Wikipedia year pages and Wikidata, plus a curated layer of the ones people actually wait
          for — eclipses, World Cups, Olympics, elections, Halley&apos;s Comet.
        </p>
        <p>
          Each row is tagged and classified: holidays, sports, astronomy, space, tech, politics, history. Search the
          whole set, filter a category, open a live countdown, and add it to a calendar.
        </p>
        <p>
          The holiday backbone comes from{" "}
          <a className="underline" href="https://date.nager.at/">
            Nager.Date
          </a>
          . Duplicate names on the same day (Christmas in 140 countries) are merged into one countdown. Wikipedia and
          Wikidata add the messier, more interesting one-offs. Curated records win when sources disagree.
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
          <dt className="text-xs uppercase tracking-[0.16em] text-muted">Built</dt>
          <dd className="mt-2 font-mono text-sm text-paper-dim">
            {meta.generatedAt ? new Date(meta.generatedAt).toISOString().slice(0, 10) : "—"}
          </dd>
        </div>
      </dl>

      <h2 className="mt-12 font-serif text-2xl text-paper">By category</h2>
      <ul className="mt-4 space-y-2 text-sm">
        {cats.map(([name, n]) => (
          <li key={name} className="flex justify-between border-b border-line/60 py-1.5">
            <span className="capitalize text-paper-dim">{name}</span>
            <span className="font-mono text-muted">{n.toLocaleString()}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 font-serif text-2xl text-paper">By source</h2>
      <ul className="mt-4 space-y-2 text-sm">
        {srcs.map(([name, n]) => (
          <li key={name} className="flex justify-between border-b border-line/60 py-1.5">
            <span className="capitalize text-paper-dim">{name}</span>
            <span className="font-mono text-muted">{n.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
