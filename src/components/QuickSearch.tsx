"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import {
  formatApproximate,
  formatCompactDate,
  isCoarsePrecision,
} from "@/lib/time";
import type { CountdownEvent } from "@/lib/types";

export function QuickSearch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CountdownEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    if (open && !dialog.current?.open) {
      dialog.current?.showModal();
      input.current?.focus();
    }
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const response = await fetch(
          `/api/events?q=${encodeURIComponent(query.trim())}&pageSize=5`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search unavailable");
        const data = await response.json();
        if (!controller.signal.aborted) setResults(data.items ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setFailed(true);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search events (Control or Command K)"
        className="flex h-11 w-11 items-center justify-center gap-3 rounded-xl border border-line bg-white/[.025] text-muted transition hover:border-amber/40 hover:text-paper sm:w-[min(340px,32vw)] sm:justify-start sm:px-3.5"
      >
        <Icon name="search" size={17} />
        <span className="hidden text-[13px] sm:inline">
          Search anything coming up…
        </span>
        <kbd className="ml-auto hidden rounded border border-white/10 px-1.5 py-0.5 text-[10px] sm:inline">
          ⌘ K
        </kbd>
      </button>
      <dialog
        ref={dialog}
        className="command-dialog"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialog.current) setOpen(false);
        }}
        aria-labelledby="quick-search-title"
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          const links = Array.from(
            dialog.current?.querySelectorAll<HTMLAnchorElement>(
              "a[data-search-result]",
            ) ?? [],
          );
          const index = links.indexOf(
            document.activeElement as HTMLAnchorElement,
          );
          if (
            document.activeElement === input.current &&
            event.key === "ArrowDown" &&
            links.length
          ) {
            event.preventDefault();
            links[0].focus();
          } else if (index >= 0) {
            event.preventDefault();
            const next = index + (event.key === "ArrowDown" ? 1 : -1);
            if (next < 0) input.current?.focus();
            else links[Math.min(next, links.length - 1)]?.focus();
          }
        }}
      >
        <h2 id="quick-search-title" className="sr-only">
          Find your next countdown
        </h2>
        <form
          action="/"
          onSubmit={() => setOpen(false)}
          className="flex items-center gap-3 border-b border-line px-5 py-4"
        >
          <Icon name="search" size={21} className="shrink-0 text-amber" />
          <input
            ref={input}
            type="search"
            name="q"
            autoComplete="off"
            maxLength={80}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setResults([]);
              setLoading(event.target.value.trim().length >= 2);
              setFailed(false);
            }}
            placeholder="An event, a holiday, a year…"
            aria-label="Search countdowns"
            className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-paper"
            aria-label="Close search"
          >
            <Icon name="close" size={18} />
          </button>
        </form>
        <div className="max-h-[55dvh] overflow-y-auto p-3">
          {query.trim().length < 2 ? (
            <div className="p-3">
              <p className="eyebrow mb-4">A little inspiration</p>
              <div className="flex flex-wrap gap-2">
                {["Halloween", "Space", "Formula 1", "Christmas 2027"].map(
                  (term) => (
                    <Link
                      key={term}
                      href={`/?q=${encodeURIComponent(term)}`}
                      onClick={() => setOpen(false)}
                      className="button-secondary !min-h-11 !px-3 !py-1.5 !text-xs"
                    >
                      <Icon name="search" size={13} />
                      {term}
                    </Link>
                  ),
                )}
              </div>
              <p className="mt-6 text-sm text-muted">
                Find a moment worth looking forward to.
              </p>
            </div>
          ) : (
            <>
              <p role="status" className="px-3 pb-2 pt-1 text-xs text-muted">
                {loading
                  ? "Finding moments…"
                  : failed
                    ? "Search is taking a break. Try again in a moment."
                    : results.length
                      ? "Matching moments"
                      : "No matches yet. Try another name or year."}
              </p>
              {results.map((event) => (
                <Link
                  key={event.id}
                  href={`/event/${event.slug}`}
                  data-search-result
                  onClick={() => setOpen(false)}
                  className="command-result"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber/10 text-amber">
                    <Icon name="calendar" size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {event.title}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {isCoarsePrecision(event.datePrecision)
                        ? formatApproximate(event.date, event.datePrecision)
                        : formatCompactDate(event.date, event.timezone)}
                    </span>
                  </span>
                  <Icon name="arrow" size={16} className="text-muted" />
                </Link>
              ))}
              <Link
                href={`/?q=${encodeURIComponent(query.trim())}`}
                onClick={() => setOpen(false)}
                className="mt-2 flex items-center justify-between rounded-xl bg-amber/10 px-4 py-3 text-sm text-amber"
              >
                See all results <Icon name="arrow" size={16} />
              </Link>
            </>
          )}
        </div>
        <div className="flex justify-between border-t border-line px-5 py-3 text-[11px] text-muted">
          <span>Type a year to jump ahead.</span>
          <span>Esc to close</span>
        </div>
      </dialog>
    </>
  );
}
