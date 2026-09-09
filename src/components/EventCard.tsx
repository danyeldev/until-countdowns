import Link from "next/link";
import type { CountdownEvent } from "@/lib/types";
import { regionSummary } from "@/lib/catalog";
import { CATEGORY_LABELS } from "@/lib/labels";
import { formatCompactDate, humanRemaining, remainingUntil } from "@/lib/time";
import { Countdown } from "./Countdown";

export function EventCard({ event, live = true }: { event: CountdownEvent; live?: boolean }) {
  const r = remainingUntil(event.date, event.allDay);
  return (
    <Link
      href={`/event/${event.slug}`}
      className="ticket group flex flex-col gap-4 rounded-2xl p-5 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-amber">
          {CATEGORY_LABELS[event.category]}
        </span>
        <time className="font-mono text-xs text-muted" dateTime={event.date}>
          {formatCompactDate(event.date)}
        </time>
      </div>
      <h3 className="font-serif text-xl leading-snug text-paper group-hover:text-amber">
        {event.title}
      </h3>
      {live ? (
        <Countdown date={event.date} allDay={event.allDay} size="card" />
      ) : (
        <p className="text-sm text-muted">{humanRemaining(r)}</p>
      )}
      <p className="line-clamp-2 text-sm text-paper-dim">{event.description}</p>
      <p className="mt-auto text-xs text-muted">{regionSummary(event.regions)}</p>
    </Link>
  );
}
