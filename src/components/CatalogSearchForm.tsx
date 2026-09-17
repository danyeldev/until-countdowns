"use client";

import { capture } from "@/lib/analytics";
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
      action="/"
      className="field mt-6 flex items-center gap-3 !py-1.5 !ps-4 !pe-1.5"
      onSubmit={(event) => {
        const query = String(new FormData(event.currentTarget).get("q") ?? "").trim();
        if (query) capture("search_submitted", { query, source: "catalog" });
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
        className="min-w-0 flex-1 bg-transparent py-2 text-sm tracking-normal outline-none"
      />
      {category && <input type="hidden" name="category" value={category} />}
      <button className="button-primary !min-h-10 !rounded-[10px] !px-4" type="submit">
        Search
      </button>
    </form>
  );
}
