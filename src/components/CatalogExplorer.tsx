import Link from "next/link";
import { EventCard } from "./EventCard";
import { CategoryBar } from "./CategoryBar";
import type { Localized } from "@/lib/i18n/bind";
import type { Category, CountdownEvent } from "@/lib/types";

const SORTS = ["soonest", "popular", "latest"] as const;

/**
 * A search that found nothing used to be a full stop: one grey sentence, and a page whose browsing
 * sections are all gated behind the unfiltered hub. It hands back the busiest categories instead,
 * so there is somewhere to go from here.
 */
function EmptyResult({ L, q, counts }: { L: Localized; q?: string; counts: Partial<Record<Category, number>> }) {
  const busiest = (Object.entries(counts) as [Category, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="mt-10 max-w-2xl">
      <p className="text-lg text-paper">{q ? L.t(L.m.home.empty.noMatch, { q }) : L.m.home.empty.nothing}</p>
      <p className="mt-2 text-sm text-muted">{L.m.home.empty.hint}</p>
      {busiest.length > 0 && (
        <>
          <p className="mt-8 text-xs uppercase tracking-[0.16em] text-muted">{L.m.home.empty.busiest}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {busiest.map(([c, n]) => (
              <li key={c}>
                <Link
                  href={L.href(`/category/${c}`)}
                  className="inline-flex items-baseline gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-paper-dim hover:border-amber/50 hover:text-paper"
                >
                  {L.m.categories.labels[c]}
                  <span className="tabular font-mono text-[10px] text-muted">{L.fmt.number(n)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-6 text-sm">
        <Link href={L.href("/days-until")} className="text-amber underline hover:text-paper">
          {L.m.home.empty.everyRecurringDate}
        </Link>
        {" · "}
        <Link href={L.href("/")} className="text-amber underline hover:text-paper">
          {L.m.home.empty.startOver}
        </Link>
      </p>
    </div>
  );
}

/**
 * Where the category name stands in the count sentence. The sentence is one message so that a
 * translator can move its pieces; the link is spliced back in where the placeholder was, which is
 * why the placeholder is filled with a marker rather than with the name itself.
 */
const CATEGORY_SLOT = "\u0000";

function ResultCount({ L, total, q, category }: { L: Localized; total: number; q?: string; category?: Category }) {
  const m = L.m.home.explorer;
  if (!category) return <>{q ? L.tn(m.countMatching, total, { q }) : L.tn(m.count, total)}</>;

  const label = L.m.categories.labels[category];
  const sentence = q
    ? L.tn(m.countMatchingInCategory, total, { q, category: CATEGORY_SLOT })
    : L.tn(m.countInCategory, total, { category: CATEGORY_SLOT });
  const [before, after] = sentence.split(CATEGORY_SLOT);
  return (
    <>
      {before}
      <Link href={L.href(`/category/${category}`)} className="underline hover:text-paper">
        {L.m.seo.hub.lowercaseCategory ? label.toLocaleLowerCase(L.tag) : label}
      </Link>
      {after}
    </>
  );
}

export function CatalogExplorer({
  L,
  events,
  total,
  page,
  pageSize,
  q,
  category,
  sort,
  counts,
}: {
  L: Localized;
  events: CountdownEvent[];
  total: number;
  page: number;
  pageSize: number;
  q?: string;
  category?: Category;
  sort?: string;
  counts: Partial<Record<Category, number>>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(next: number) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (category) p.set("category", category);
    if (sort) p.set("sort", sort);
    if (next > 1) p.set("page", String(next));
    const s = p.toString();
    return L.href(s ? `/?${s}` : "/");
  }

  function sortHref(next: string) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (category) p.set("category", category);
    if (next !== "soonest") p.set("sort", next);
    return L.href(`/?${p.toString()}`);
  }

  return (
    <section className="mt-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-3xl text-paper">{L.m.home.explorer.heading}</h2>
          <p className="mt-1 text-sm text-muted">
            <ResultCount L={L} total={total} q={q} category={category} />
          </p>
        </div>
        <div className="flex gap-2 text-xs uppercase tracking-[0.14em]">
          {SORTS.map((value) => (
            <Link
              key={value}
              href={sortHref(value)}
              className={`rounded-full px-3 py-1.5 ${
                (sort || "soonest") === value
                  ? "bg-paper text-ink"
                  : "border border-line text-paper-dim hover:text-paper"
              }`}
            >
              {L.m.home.explorer.sort[value]}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <CategoryBar L={L} active={category} counts={counts} q={q} sort={sort} />
      </div>

      {events.length === 0 ? (
        <EmptyResult L={L} q={q} counts={counts} />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-10 flex items-center justify-between text-sm text-paper-dim">
          <span>{L.t(L.m.common.pagination.pageOf, { n: L.fmt.number(page), total: L.fmt.number(pages) })}</span>
          <div className="flex gap-3">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="hover:text-paper">
                {L.m.common.pagination.previous}
              </Link>
            )}
            {page < pages && (
              <Link href={pageHref(page + 1)} className="hover:text-paper">
                {L.m.common.pagination.next}
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
