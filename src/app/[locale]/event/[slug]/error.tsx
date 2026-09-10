"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { localePath, parsePath } from "@/lib/i18n/paths";

/**
 * Shown when the catalog read behind an event page fails (CatalogReadError). The page is
 * served as a 500 and is not cached, so a retry after the database recovers renders normally.
 *
 * The copy stays English: an error boundary has to be a Client Component, which cannot reach the
 * message catalogue, and a 500 is never indexed — nothing here is worth a prop-drilled catalogue.
 * The way out is another matter, so the link back is built for the locale the reader is in.
 */
export default function EventError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const { locale } = parsePath(usePathname());

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.24em] text-amber">Temporarily unavailable</p>
      <h1 className="mt-3 font-serif text-4xl text-paper">This countdown could not be loaded</h1>
      <p className="mt-4 max-w-xl text-paper-dim">
        The catalog did not answer in time. The date has not gone anywhere — try again in a moment.
      </p>
      <div className="mt-6 flex gap-4">
        <button type="button" onClick={reset} className="rounded-full bg-amber px-5 py-2.5 text-sm font-medium text-ink hover:bg-paper">
          Try again
        </button>
        <Link href={localePath(locale, "/")} className="rounded-full border border-line px-5 py-2.5 text-sm text-paper-dim hover:text-paper">
          Back to the catalog
        </Link>
      </div>
    </div>
  );
}
