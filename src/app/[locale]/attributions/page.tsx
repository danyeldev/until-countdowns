import { Breadcrumbs } from "@/components/Breadcrumbs";
import { imageLicenses, sourcesList } from "@/lib/catalog";
import { providerLabel } from "@/lib/images";
import { localizedMetadata } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata() {
  return localizedMetadata({
  title: "Attributions — where the dates come from",
  description:
    "Every source behind the Until catalog, with its licence and the attribution it asks for: date-holidays, Wikipedia, Wikidata, Hebcal, Launch Library and more.",
  canonical: "/attributions",
  ogPath: "/og/default",
});
}

export default async function AttributionsPage() {
  const [sources, licenses] = await Promise.all([sourcesList(), imageLicenses()]);
  const images = licenses.reduce((total, row) => total + row.count, 0);
  return (
    <article>
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Attributions", path: "/attributions" }]} />
      <p className="eyebrow mt-7">Sources</p>
      <h1 className="page-heading mt-3">Attributions</h1>
      <p className="page-subtitle mt-4 max-w-3xl">
        Until only ingests sources whose terms allow storing and republishing the data. Share-alike sources
        (Wikipedia text, TVMaze, date-holidays data) are credited on every page that uses them; images are
        re-hosted only under CC0, public domain, CC BY or CC BY-SA licences with the author named. Each event
        page links back to the record it was built from.
      </p>
      {sources.length === 0 ? (
        <p className="mt-10 text-sm text-muted">Source list unavailable right now.</p>
      ) : (
        <ul className="mt-8 grid gap-x-10 sm:grid-cols-2">
          {sources.map((s) => (
            <li key={s.id} className="border-t border-line py-5">
              <p className="flex flex-wrap items-center gap-3 text-lg font-semibold text-paper">
                {s.homepage ? (
                  <a href={s.homepage} className="inline-flex min-h-11 items-center underline decoration-line underline-offset-4 hover:text-amber" target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                ) : (
                  s.label
                )}
                {s.license ? <span className="pill">{s.license}</span> : null}
              </p>
              {s.attribution ? <p className="mt-3 text-sm leading-relaxed text-paper-dim">{s.attribution}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <h2 className="mt-14 section-heading text-paper">Images</h2>
      <p className="mt-3 max-w-3xl leading-relaxed text-paper-dim">
        Photos are re-hosted copies, resized and served from our own storage so the original hosts are never
        hotlinked. Only freely licensed files are accepted — CC0, public domain, CC BY, CC BY-SA and a few
        national open-government licences, plus NASA imagery under its media guidelines. Fair-use files,
        non-commercial (NC) and no-derivatives (ND) licences are rejected outright, as are files carrying a
        trademark or personality restriction, and every stored file keeps its author, licence and a link back
        to the file page. Events with no free photo get a generated card instead.
      </p>
      <p className="mt-3 max-w-3xl leading-relaxed text-paper-dim">
        Share-alike photos (CC BY-SA) are published unmodified, at their own proportions, with the credit
        beneath them. They are never cropped into a social card: that composite would be a derivative work and
        would have to carry the same share-alike licence, so those cards use the generated design instead.
        Stored files are re-verified against their source monthly; one that has been deleted or is no longer
        free is removed from our storage and its pages fall back to the generated card.
      </p>
      {licenses.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No re-hosted images yet.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">
            {images.toLocaleString("en-US")} image{images === 1 ? "" : "s"} in the library today:
          </p>
          <ul className="mt-4 divide-y divide-line">
            {licenses.map((row) => (
              <li key={`${row.provider}:${row.license}`} className="flex items-baseline justify-between gap-4 py-2">
                <span className="text-paper-dim">
                  {providerLabel(row.provider)}
                  <span className="pill ms-2">{row.license}</span>
                </span>
                <span className="tabular font-mono text-xs text-muted">{row.count.toLocaleString("en-US")}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-10 text-sm text-muted">
        Fonts: Geist and Geist Mono (SIL Open Font License). Astronomy computed with
        astronomy-engine (MIT).
      </p>
    </article>
  );
}
