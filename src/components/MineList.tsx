"use client";

import Link from "next/link";
import { useState } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { formatCompactDate } from "@/lib/time";

export function MineList() {
  const { ready, mine, removeMine } = useCollection();
  const [error, setError] = useState("");
  if (!ready || mine.length === 0) return null;
  return (
    <section className="mt-10 border-t border-line pt-8" aria-label="Your recent countdowns">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="section-heading">Made by you</h2><p className="mt-1 text-sm text-muted">Your most recently created moments.</p></div><Link href="/saved" className="button-secondary">View collection <span aria-hidden="true">↗</span></Link></div>
      {error && <p role="alert" className="mt-4 rounded-xl border border-line bg-ink-2 p-4 text-sm text-paper">{error}</p>}
      <ul className="panel mt-5 divide-y divide-line overflow-hidden">{mine.slice(0, 3).map((event) => (
        <li key={event.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <Link href={`/event/${event.slug}`} className="flex min-w-0 flex-1 items-center gap-4 rounded-xl py-2 hover:text-amber"><span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber/10 text-lg font-semibold tabular-nums text-amber">{event.date.slice(8, 10)}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{event.title}</span><span className="mt-1 block text-xs text-muted">{formatCompactDate(event.date)}</span></span></Link>
          <button type="button" aria-label={`Remove ${event.title}`} onClick={() => { void removeMine(event.id).then(() => setError("")).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not remove this countdown.")); }} className="min-h-11 shrink-0 rounded-xl px-3 text-xs text-muted hover:bg-ink hover:text-paper">Remove</button>
        </li>
      ))}</ul>
      {mine.length > 3 && <p className="mt-4 text-sm text-muted">{mine.length - 3} more in <Link className="text-amber underline underline-offset-4" href="/saved">your collection</Link>.</p>}
    </section>
  );
}
