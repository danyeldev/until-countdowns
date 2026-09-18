import { Link } from "@/i18n/navigation";
import type { CountdownEvent, SeriesOccurrencePreview } from "@/lib/types";
import { regionSummary } from "@/lib/regions";
import { isShareAlike } from "@/lib/images";
import { CATEGORY_LABELS } from "@/lib/labels";
import {
  formatApproximate,
  formatCompactDate,
  humanDays,
  isCoarsePrecision,
} from "@/lib/time";
import { Countdown } from "./Countdown";
import { EventImage } from "./EventImage";
import { FallbackCard } from "./FallbackCard";
import { StatusBadge } from "./StatusBadge";
import { SaveButton } from "./SaveButton";
import { Icon } from "./Icon";
import { CardHype } from "./CardHype";

export function EventCard({
  event,
  live = false,
  showSeriesLink = false,
  futureOccurrences,
  href,
  showSave = true,
}: {
  event: CountdownEvent;
  live?: boolean;
  showSeriesLink?: boolean;
  futureOccurrences?: SeriesOccurrencePreview[];
  href?: string;
  showSave?: boolean;
}) {
  const coarse = isCoarsePrecision(event.datePrecision);
  const hasSeriesLink = showSeriesLink && Boolean(event.seriesSlug);
  const laterDates = (futureOccurrences ?? []).slice(0, 4);
  const path = href ?? `/event/${event.slug}`;
  return (
    <article className="event-card group relative flex min-w-0 flex-col">
      <Link
        href={path}
        className={`flex ${hasSeriesLink ? "flex-1" : "h-full"} flex-col focus-visible:outline-offset-[-3px]`}
      >
        {event.image && !isShareAlike(event.image.license) ? (
          <EventImage
            image={event.image}
            alt=""
            variant="card"
            className="event-art"
          />
        ) : (
          <FallbackCard
            slug={event.slug}
            title={event.title}
            category={event.category}
          />
        )}
        <div className="flex flex-1 flex-col p-5">
          <div className="flex flex-wrap items-center gap-2 pr-10 text-[10px] font-medium uppercase tracking-[.1em] text-muted">
            {CATEGORY_LABELS[event.category]}
            <StatusBadge status={event.status} />
          </div>
          <h3 className="mt-2 line-clamp-2 min-h-[2.75rem] text-[17px] font-semibold leading-[1.3] tracking-[-.025em] text-paper group-hover:text-amber">
            {event.title}
          </h3>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <Icon name="calendar" size={13} />
            <time dateTime={event.date}>
              {coarse
                ? formatApproximate(event.date, event.datePrecision)
                : formatCompactDate(event.date, event.timezone)}
            </time>
          </p>
          <div className="mt-auto pt-5">
            {live ? (
              <Countdown
                date={event.date}
                allDay={event.allDay}
                size="card"
                initialDays={event.daysUntil}
                precision={event.datePrecision}
                status={event.status}
              />
            ) : (
              <p className="text-sm text-amber">
                {coarse
                  ? formatApproximate(event.date, event.datePrecision)
                  : humanDays(event.daysUntil)}
              </p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
            <p className="truncate text-[10px] text-muted">
              {regionSummary(event.regions)}
            </p>
            <Icon name="arrow" size={14} className="shrink-0 text-amber" />
          </div>
        </div>
      </Link>
      {hasSeriesLink && laterDates.length > 0 ? (
        <details className="group/years border-t border-line/60 bg-ink/25">
          <summary
            aria-label={`More years for ${event.seriesTitle || event.title}`}
            className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm text-amber hover:bg-ink focus-visible:outline-offset-[-3px] [&::-webkit-details-marker]:hidden"
          >
            <span>More years</span>
            <Icon
              name="plus"
              size={14}
              className="transition-transform group-open/years:rotate-45"
              aria-hidden="true"
            />
          </summary>
          <div className="px-5 pb-4">
            <ul
              className="flex flex-wrap gap-2"
              aria-label={`Later dates for ${event.seriesTitle || event.title}`}
            >
              {laterDates.map((occurrence) => {
                const approximate = isCoarsePrecision(occurrence.datePrecision);
                const label = approximate
                  ? formatApproximate(occurrence.date, occurrence.datePrecision)
                  : formatCompactDate(occurrence.date, occurrence.timezone);
                return (
                  <li key={occurrence.slug}>
                    <Link
                      href={`/event/${occurrence.slug}`}
                      aria-label={`${occurrence.title} — ${label}`}
                      className="inline-flex rounded-lg border border-line bg-ink-2 px-3 py-3 font-mono text-xs text-paper-dim hover:border-amber hover:text-amber"
                    >
                      {approximate ? (
                        <span>{label}</span>
                      ) : (
                        <time dateTime={occurrence.date}>{label}</time>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link
              href={`/days-until/${event.seriesSlug}`}
              aria-label={`All dates for ${event.seriesTitle || event.title}`}
              className="mt-3 inline-flex items-center gap-2 text-sm text-amber hover:underline"
            >
              All dates
              <Icon name="arrow" size={14} aria-hidden="true" />
            </Link>
          </div>
        </details>
      ) : hasSeriesLink ? (
        <Link
          href={`/days-until/${event.seriesSlug}`}
          aria-label={`All dates for ${event.seriesTitle || event.title}`}
          className="flex items-center justify-between gap-3 border-t border-line bg-ink/40 px-5 py-3 text-sm text-amber hover:bg-ink focus-visible:outline-offset-[-3px]"
        >
          <span>All dates</span>
          <Icon name="arrow" size={14} aria-hidden="true" />
        </Link>
      ) : null}
      <div className="pointer-events-none absolute left-3 top-3 z-10">
        <CardHype event={event} points={event.hype} />
      </div>
      {showSave ? (
        <div className="absolute right-3 top-3 z-10">
          <SaveButton id={event.id} event={event} compact />
        </div>
      ) : null}
    </article>
  );
}
