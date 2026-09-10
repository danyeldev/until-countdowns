"use client";

import Link from "next/link";
import { bind } from "@/lib/i18n/bind";
import type { Locale } from "@/lib/i18n/config";
import type { PluralForms } from "@/lib/i18n/format";
import { removeMine } from "@/lib/user-events";
import { useMine, useSavedIds } from "@/lib/use-local-store";

/** `L.m.event.mine`, handed over by the server parent — a Client Component cannot read the catalogue. */
type Messages = {
  onThisDevice: string;
  remove: string;
  savedCount: PluralForms;
};

export function MineList({ locale, m }: { locale: Locale; m: Messages }) {
  const L = bind(locale);
  const mine = useMine();
  const saved = useSavedIds();

  if (mine.length === 0 && saved.length === 0) return null;

  return (
    <section className="mt-16 border-t border-line pt-10">
      {mine.length > 0 && (
        <>
          <h2 className="font-serif text-2xl text-paper">{m.onThisDevice}</h2>
          <ul className="mt-4 divide-y divide-line">
            {mine.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-4 py-3">
                <Link href={L.href(`/event/${event.slug}`)} className="min-w-0 hover:text-amber">
                  <span className="block truncate font-medium">{event.title}</span>
                  <span className="font-mono text-xs text-muted">{L.fmt.compactDate(event.date)}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => removeMine(event.id)}
                  className="text-xs text-muted hover:text-paper"
                >
                  {m.remove}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {saved.length > 0 && <p className="mt-8 text-sm text-muted">{L.tn(m.savedCount, saved.length)}</p>}
    </section>
  );
}
