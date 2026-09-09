import { CatalogExplorer } from "@/components/CatalogExplorer";
import { EventCard } from "@/components/EventCard";
import { FeaturedHero } from "@/components/FeaturedHero";
import { categoryCounts, featuredUpcoming, searchEvents } from "@/lib/catalog";
import { CATEGORIES, type Category } from "@/lib/types";

type Props = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  }>;
};

export default async function Home({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const category = CATEGORIES.includes(sp.category as Category) ? (sp.category as Category) : undefined;
  const sort = (["soonest", "popular", "latest"] as const).includes(sp.sort as "soonest")
    ? (sp.sort as "soonest" | "popular" | "latest")
    : "soonest";
  const page = Math.max(1, Number(sp.page) || 1);

  const highlights = featuredUpcoming(5);
  const featured = highlights[0];
  const more = highlights.slice(1, 5);
  const result = searchEvents({
    q,
    category,
    sort,
    page,
    pageSize: 24,
  });
  const counts = categoryCounts();

  return (
    <div>
      {!q && !category && page === 1 && featured ? (
        <>
          <FeaturedHero event={featured} />
          {more.length > 0 && (
            <section className="mt-10">
              <h2 className="font-serif text-2xl text-paper">Also on the horizon</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {more.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}

      <form action="/" className="mt-8 sm:hidden">
        <label className="sr-only" htmlFor="mobile-search">
          Search
        </label>
        <input
          id="mobile-search"
          name="q"
          defaultValue={q}
          placeholder="Search the catalog…"
          className="w-full rounded-full border border-line bg-ink-2 px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-amber/60"
        />
      </form>

      <CatalogExplorer
        events={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        q={q}
        category={category}
        sort={sort}
        counts={counts}
      />
    </div>
  );
}
