"use client";

import { Link } from "@/i18n/navigation";
import { useState } from "react";
import { Icon } from "./Icon";

type CountryRow = { code: string; name: string; n: number };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function CountryDirectory({ countries }: { countries: CountryRow[] }) {
  const [query, setQuery] = useState("");
  const needle = normalize(query.trim());
  const filtered = countries.filter((country) => normalize(`${country.name} ${country.code}`).includes(needle));
  const groups = new Map<string, CountryRow[]>();
  for (const country of filtered) {
    const letter = normalize(country.name)[0].toUpperCase();
    const rows = groups.get(letter) ?? [];
    rows.push(country);
    groups.set(letter, rows);
  }

  return (
    <div className="mt-8">
      <div className="panel flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <label htmlFor="country-search" className="sr-only">Find a country or territory</label>
          <input id="country-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a country or territory" className="field" style={{ paddingLeft: "2.75rem" }} />
        </div>
        <p className="text-sm text-paper-dim" role="status">{filtered.length} {filtered.length === 1 ? "country or territory" : "countries and territories"}</p>
      </div>
      {groups.size > 0 ? (
        <>
          <nav aria-label="Country initials" className="mt-5 flex flex-wrap gap-1">
            {[...groups.keys()].map((letter) => <a key={letter} href={`#country-${letter}`} className="flex size-11 items-center justify-center rounded-xl text-sm font-medium text-paper-dim hover:bg-ink-2 hover:text-amber">{letter}</a>)}
          </nav>
          {[...groups.entries()].map(([letter, rows]) => (
            <section id={`country-${letter}`} key={letter} className="mt-9 scroll-mt-28">
              <h2 className="mb-4 flex items-center gap-4 text-lg font-semibold text-amber"><span>{letter}</span><span className="h-px flex-1 bg-line" /></h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((country) => (
                  <li key={country.code}>
                    <Link href={`/country/${country.code.toLowerCase()}`} className="ticket group flex h-full items-center gap-3 rounded-2xl p-4">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber/10 text-sm font-semibold text-amber" aria-hidden="true">{country.code}</span>
                      <span className="min-w-0 flex-1"><span className="block font-medium text-paper">{country.name}</span><span className="mt-1 block text-sm text-muted">{country.n.toLocaleString("en-US")} upcoming dates</span></span>
                      <Icon name="arrow" size={16} className="shrink-0 text-muted group-hover:text-amber" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      ) : <div className="empty-state mt-6"><h2 className="text-xl font-semibold text-paper">No countries found</h2><p className="mt-2 text-paper-dim">Try a country name or its two-letter code.</p><button type="button" className="button-secondary mt-5" onClick={() => setQuery("")}>Clear search</button></div>}
    </div>
  );
}
