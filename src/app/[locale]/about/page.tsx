import type { Metadata } from "next";
import { Fragment } from "react";
import { catalogMeta } from "@/lib/catalog";
import { i18n, localePage } from "@/lib/i18n/server";
import { sourceLabel } from "@/lib/labels";
import { buildMetadata } from "@/lib/seo";
import type { Category } from "@/lib/types";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const L = await i18n();
  return buildMetadata({
    locale: L.locale,
    title: L.m.pages.about.title,
    description: L.m.pages.about.description,
    canonical: "/about",
    ogPath: "/og/default",
  });
}

/**
 * Fills a message whose placeholders are elements rather than words, so the sourcing paragraph
 * stays one translatable sentence and the translator, not the JSX, decides where the three
 * dataset links fall in it.
 */
function fillNodes(template: string, parts: Record<string, React.ReactNode>): React.ReactNode[] {
  return template.split(/(\{\w+\})/g).map((chunk, i) => {
    const key = /^\{(\w+)\}$/.exec(chunk)?.[1];
    return key && key in parts ? <Fragment key={i}>{parts[key]}</Fragment> : chunk;
  });
}

export default async function AboutPage() {
  const L = await localePage();
  const m = L.m.pages.about;
  const labels = L.m.categories.labels;
  const meta = await catalogMeta();
  const cats = Object.entries(meta.stats.byCat).sort((a, b) => b[1] - a[1]);
  const srcs = Object.entries(meta.stats.bySrc).sort((a, b) => b[1] - a[1]);
  const updated = L.fmt.compactDate(meta.generatedAt.slice(0, 10));

  return (
    <article className="max-w-2xl">
      <p className="text-[11px] uppercase tracking-[0.24em] text-amber">{m.eyebrow}</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">{m.heading}</h1>
      <div className="mt-8 space-y-5 text-paper-dim leading-relaxed">
        <p>{m.intro}</p>
        <p>{L.t(m.categories, { n: L.fmt.number(Object.keys(labels).length) })}</p>
        <p>
          {fillNodes(m.sources, {
            dateHolidays: (
              <a
                className="underline"
                href="https://github.com/commenthol/date-holidays"
                target="_blank"
                rel="noreferrer"
              >
                date-holidays
              </a>
            ),
            wikidata: (
              <a className="underline" href="https://www.wikidata.org/" target="_blank" rel="noreferrer">
                Wikidata
              </a>
            ),
            wikipedia: (
              <a className="underline" href="https://en.wikipedia.org/" target="_blank" rel="noreferrer">
                Wikipedia
              </a>
            ),
          })}
        </p>
        <p>{m.expected}</p>
        <p>{m.yourOwn}</p>
      </div>

      <dl className="mt-12 grid gap-6 sm:grid-cols-3">
        <div className="ticket rounded-2xl p-5">
          <dt className="text-xs uppercase tracking-[0.16em] text-muted">{m.stats.dates}</dt>
          <dd className="mt-2 font-mono text-3xl text-amber">{L.fmt.number(meta.count)}</dd>
        </div>
        <div className="ticket rounded-2xl p-5">
          <dt className="text-xs uppercase tracking-[0.16em] text-muted">{m.stats.featured}</dt>
          <dd className="mt-2 font-mono text-3xl text-amber">{L.fmt.number(meta.stats.featured)}</dd>
        </div>
        <div className="ticket rounded-2xl p-5">
          <dt className="text-xs uppercase tracking-[0.16em] text-muted">{m.stats.updated}</dt>
          <dd className="mt-2 font-mono text-sm text-paper-dim">{updated}</dd>
        </div>
      </dl>

      <h2 className="mt-12 font-serif text-2xl text-paper">{m.byCategory.heading}</h2>
      {cats.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{m.byCategory.empty}</p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm">
          {cats.map(([name, n]) => (
            <li key={name} className="flex justify-between border-b border-line/60 py-1.5">
              <span className="text-paper-dim">{labels[name as Category] ?? name}</span>
              <span className="font-mono text-muted">{L.fmt.number(n)}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-12 font-serif text-2xl text-paper">{m.bySource.heading}</h2>
      {srcs.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{m.bySource.empty}</p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm">
          {srcs.map(([name, n]) => (
            <li key={name} className="flex justify-between border-b border-line/60 py-1.5">
              <span className="text-paper-dim">{sourceLabel(name, meta.sourceLabels)}</span>
              <span className="font-mono text-muted">{L.fmt.number(n)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
