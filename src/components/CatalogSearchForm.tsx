"use client";

import { ANALYTICS_EVENTS, capture } from "@/lib/analytics";
import { Icon } from "./Icon";

export function CatalogSearchForm({
  q,
  category,
}: {
  q?: string;
  category?: string;
}) {
  return (
    <form
      action="/search"
      className="mt-6 flex items-center gap-3 rounded-full border border-line bg-ink-2 p-2 pl-4"
      onSubmit={(event) => {
        const query = String(new FormData(event.currentTarget).get("q") ?? "").trim();
        if (query) capture(ANALYTICS_EVENTS.searchSubmitted, { query, source: "catalog" });
      }}
    >
      <Icon name="search" className="text-muted" />
      <label htmlFor="catalog-search" className="sr-only">
        Search countdowns
      </label>
      <input
        id="catalog-search"
        key={q ?? ""}
        type="search"
        name="q"
        maxLength={80}
        defaultValue={q}
        placeholder="Search the whole catalog…"
        className="min-w-0 flex-1 bg-transparent py-2 text-sm tracking-normal outline-none placeholder:text-muted"
      />
      {category && <input type="hidden" name="category" value={category} />}
      <button className="button-primary !rounded-full" type="submit">
        Search
      </button>
    </form>
  );
}
