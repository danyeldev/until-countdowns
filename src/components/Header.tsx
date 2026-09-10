"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

const NAV: { href: string; label: string; match: (path: string) => boolean }[] = [
  { href: "/category", label: "Categories", match: (p) => p.startsWith("/category") },
  { href: "/country", label: "Countries", match: (p) => p.startsWith("/country") },
  { href: "/days-until", label: "Days until", match: (p) => p.startsWith("/days-until") },
  { href: "/create", label: "Create", match: (p) => p === "/create" },
  { href: "/about", label: "About", match: (p) => p === "/about" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const next = q.trim();
    const usp = new URLSearchParams(params.toString());
    if (next) usp.set("q", next);
    else usp.delete("q");
    usp.delete("page");
    router.push(`/${usp.toString() ? `?${usp}` : ""}`);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0 font-serif text-2xl tracking-tight text-paper">
          Until
        </Link>
        <form onSubmit={onSearch} className="hidden min-w-0 flex-1 sm:block">
          <label className="sr-only" htmlFor="nav-search">
            Search countdowns
          </label>
          <input
            id="nav-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search eclipses, World Cups, holidays…"
            className="w-full rounded-full border border-line bg-ink-2 px-4 py-2 text-sm text-paper outline-none placeholder:text-muted focus:border-amber/60"
          />
        </form>
        <nav className="ml-auto flex items-center gap-3 overflow-x-auto text-sm text-paper-dim sm:gap-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 ${item.match(pathname) ? "text-paper" : "hover:text-paper"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
