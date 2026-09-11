import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { imageLicenses, sourcesList } from "@/lib/catalog";
import { i18n, localePage } from "@/lib/i18n/server";
import { providerLabel } from "@/lib/images";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const L = await i18n();
  return buildMetadata({
    locale: L.locale,
    title: L.m.pages.attributions.title,
    description: L.m.pages.attributions.description,
    canonical: "/attributions",
    ogPath: "/og/default",
  });
}

export default async function AttributionsPage() {
  const L = await localePage();
  const m = L.m.pages.attributions;
  const [sources, licenses] = await Promise.all([sourcesList(), imageLicenses()]);
  const images = licenses.reduce((total, row) => total + row.count, 0);
  return (
    <article className="max-w-2xl">
      <Breadcrumbs
        items={[
          { name: L.m.common.breadcrumb.home, path: "/" },
          { name: m.heading, path: "/attributions" },
        ]}
      />
      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-amber">{m.eyebrow}</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">{m.heading}</h1>
      <p className="mt-4 text-paper-dim">{m.intro}</p>
      {sources.length === 0 ? (
        <p className="mt-10 text-sm text-muted">{m.sourcesEmpty}</p>
      ) : (
        <ul className="mt-10 divide-y divide-line/60">
          {sources.map((s) => (
            <li key={s.id} className="py-4">
              <p className="text-paper">
                {s.homepage ? (
                  <a href={s.homepage} className="underline hover:text-amber" target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                ) : (
                  s.label
                )}
                {s.license ? <span className="ms-2 font-mono text-xs text-muted">{s.license}</span> : null}
              </p>
              {s.attribution ? <p className="mt-1 text-sm text-paper-dim">{s.attribution}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <h2 className="mt-14 font-serif text-2xl text-paper">{m.images.heading}</h2>
      <p className="mt-3 text-paper-dim">{m.images.policy}</p>
      <p className="mt-3 text-paper-dim">{m.images.shareAlike}</p>
      {licenses.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{m.images.empty}</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">{L.tn(m.images.count, images)}</p>
          <ul className="mt-4 divide-y divide-line/60">
            {licenses.map((row) => (
              <li key={`${row.provider}:${row.license}`} className="flex items-baseline justify-between gap-4 py-2">
                <span className="text-paper-dim">
                  {providerLabel(row.provider)}
                  <span className="ms-2 font-mono text-xs text-muted">{row.license}</span>
                </span>
                <span className="tabular font-mono text-xs text-muted">{L.fmt.number(row.count)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-10 text-sm text-muted">{m.fonts}</p>
    </article>
  );
}
