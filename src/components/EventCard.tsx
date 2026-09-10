import Link from "next/link";
import type { CountdownEvent } from "@/lib/types";
import { regionSummary } from "@/lib/i18n/regions";
import { i18n } from "@/lib/i18n/server";
import { displayTitle, formatApproximate } from "@/lib/seo";
import { isCoarsePrecision } from "@/lib/time";
import { Countdown } from "./Countdown";
import { EventImage } from "./EventImage";
import { FallbackCard } from "./FallbackCard";
import { StatusBadge } from "./StatusBadge";

/** Reads the locale itself, so every grid that lists cards keeps calling it with just the row. */
export async function EventCard({ event, live = true }: { event: CountdownEvent; live?: boolean }) {
  const L = await i18n();
  const coarse = isCoarsePrecision(event.datePrecision);
  const title = displayTitle(L, event);
  return (
    <Link
      href={L.href(`/event/${event.slug}`)}
      className="ticket group flex flex-col gap-4 overflow-hidden rounded-2xl transition-colors"
    >
      {/* Fixed 16:9 whether the event has a photo or not, so a mixed grid never reflows. */}
      {event.image ? (
        <EventImage image={event.image} alt={title} variant="card" className="rounded-t-2xl" />
      ) : (
        <FallbackCard slug={event.slug} title={title} category={event.category} className="rounded-t-2xl" />
      )}
      <div className="flex items-start justify-between gap-3 px-5">
        <span className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-amber">
          {L.m.categories.labels[event.category]}
          <StatusBadge status={event.status} />
        </span>
        <time className="font-mono text-xs text-muted" dateTime={event.date}>
          {coarse
            ? formatApproximate(L, event.date, event.datePrecision)
            : L.fmt.compactDate(event.date, event.timezone)}
        </time>
      </div>
      <h3 className="px-5 font-serif text-xl leading-snug text-paper group-hover:text-amber">
        {title}
      </h3>
      {live ? (
        <div className="px-5">
          <Countdown
            date={event.date}
            allDay={event.allDay}
            size="card"
            initialDays={event.daysUntil}
            precision={event.datePrecision}
            locale={L.locale}
            labels={L.m.embed.countdown}
            approximate={coarse ? formatApproximate(L, event.date, event.datePrecision) : undefined}
          />
        </div>
      ) : (
        <p className="px-5 text-sm text-muted">
          {coarse ? formatApproximate(L, event.date, event.datePrecision) : L.fmt.humanDays(event.daysUntil)}
        </p>
      )}
      <p className="line-clamp-2 px-5 text-sm text-paper-dim">{event.summary || event.description}</p>
      <p className="mt-auto px-5 pb-5 text-xs text-muted">{regionSummary(L, event.regions)}</p>
    </Link>
  );
}
