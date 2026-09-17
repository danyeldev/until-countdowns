"use client";

import { Link } from "@/i18n/navigation";
import { useState } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { formatCompactDate } from "@/lib/time";

export function MineList() {
  const { ready, mine, removeMine } = useCollection();
  const [error, setError] = useState("");
  if (!ready || mine.length === 0) return null;
  return (
    <section className="hairline mt-16 pt-10" aria-label="Your recent countdowns">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="section-heading">Made by you</h2><p className="mt-1 text-sm text-muted">Your most recently created moments.</p></div><Link href="/saved" className="button-secondary">View collection <span aria-hidden="true">↗</span></Link></div>
      {error && <p role="alert" className="notice mt-4">{error}</p>}
      <ul className="mt-4 divide-y divide-line">{mine.slice(0, 3).map((event) => (
        <li key={event.id} className="flex items-center justify-between gap-3 py-2">
          <Link href={`/event/${event.slug}`} className="flex min-w-0 flex-1 items-center gap-4 rounded-xl py-2 hover:text-amber"><span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-lg font-semibold tabular-nums text-amber">{event.date.slice(8, 10)}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{event.title}</span><span className="mt-1 block text-xs text-muted">{formatCompactDate(event.date)}</span></span></Link>
          <button type="button" aria-label={`Remove ${event.title}`} onClick={() => { void removeMine(event.id).then(() => setError("")).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not remove this countdown.")); }} className="button-ghost !min-h-10 !px-3 text-xs">Remove</button>
        </li>
      ))}</ul>
      {mine.length > 3 && <p className="mt-4 text-sm text-muted">{mine.length - 3} more in <Link className="text-amber underline underline-offset-4" href="/saved">your collection</Link>.</p>}
    </section>
  );
}
