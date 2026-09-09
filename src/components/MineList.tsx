"use client";

import Link from "next/link";
import { removeMine } from "@/lib/user-events";
import { useMine, useSavedIds } from "@/lib/use-local-store";
import { formatCompactDate } from "@/lib/time";

export function MineList() {
  const mine = useMine();
  const saved = useSavedIds();

  if (mine.length === 0 && saved.length === 0) return null;

  return (
    <section className="mt-16 border-t border-line pt-10">
      {mine.length > 0 && (
        <>
          <h2 className="font-serif text-2xl text-paper">On this device</h2>
          <ul className="mt-4 divide-y divide-line">
            {mine.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-4 py-3">
                <Link href={`/event/${event.slug}`} className="min-w-0 hover:text-amber">
                  <span className="block truncate font-medium">{event.title}</span>
                  <span className="font-mono text-xs text-muted">{formatCompactDate(event.date)}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => removeMine(event.id)}
                  className="text-xs text-muted hover:text-paper"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {saved.length > 0 && (
        <p className="mt-8 text-sm text-muted">{saved.length} catalog dates saved in this browser.</p>
      )}
    </section>
  );
}
