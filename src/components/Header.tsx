"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { localePath, parsePath } from "@/lib/i18n/paths";

type Nav = { categories: string; countries: string; daysUntil: string; create: string; about: string };
type Search = { label: string; navLabel: string; placeholder: string; navPlaceholder: string; submit: string };

/** App-internal paths; `localePath()` gives each one its spelling in the reader's locale. */
const NAV: { path: string; key: keyof Nav; exact?: boolean }[] = [
  { path: "/category", key: "categories" },
  { path: "/country", key: "countries" },
  { path: "/days-until", key: "daysUntil" },
  { path: "/create", key: "create", exact: true },
  { path: "/about", key: "about", exact: true },
];

export function Header({
  locale,
  nav,
  search,
  siteName,
}: {
  locale: Locale;
  nav: Nav;
  search: Search;
  siteName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  // `usePathname()` is the *public* path (`/es/categoria/sports`), which is exactly what the browser
  // shows and what a rewrite hides from the server. Parsing it back to the app-internal path is how
  // the nav knows which item is active without every locale needing its own matcher.
  const here = parsePath(pathname).path;
  const home = localePath(locale, "/");

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const next = q.trim();
    const usp = new URLSearchParams(params.toString());
    if (next) usp.set("q", next);
    else usp.delete("q");
    usp.delete("page");
    router.push(`${home}${usp.toString() ? `?${usp}` : ""}`);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href={home} className="shrink-0 font-serif text-2xl tracking-tight text-paper">
          {siteName}
        </Link>
        <form onSubmit={onSearch} className="hidden min-w-0 flex-1 sm:block">
          <label className="sr-only" htmlFor="nav-search">
            {search.navLabel}
          </label>
          <input
            id="nav-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={search.navPlaceholder}
            className="w-full rounded-full border border-line bg-ink-2 px-4 py-2 text-sm text-paper outline-none placeholder:text-muted focus:border-amber/60"
          />
        </form>
        <nav className="ms-auto flex items-center gap-3 overflow-x-auto text-sm text-paper-dim sm:gap-4">
          {NAV.map((item) => {
            const active = item.exact ? here === item.path : here.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={localePath(locale, item.path)}
                className={`shrink-0 ${active ? "text-paper" : "hover:text-paper"}`}
              >
                {nav[item.key]}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
