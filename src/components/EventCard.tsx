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
  live = true,
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
  const regions = regionSummary(event.regions);
  return (
    <article className="event-card group flex min-w-0 flex-col">
      <Link href={path} className="flex flex-1 flex-col rounded-2xl">
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
        <div className="flex flex-1 flex-col pt-4">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span>{CATEGORY_LABELS[event.category]}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={event.date}>
              {coarse
                ? formatApproximate(event.date, event.datePrecision)
                : formatCompactDate(event.date, event.timezone)}
            </time>
            <StatusBadge status={event.status} />
          </p>
          <h3 className="mt-1.5 line-clamp-2 text-[17px] font-semibold leading-[1.3] tracking-[-.02em] text-paper group-hover:text-amber">
            {event.title}
          </h3>
          <div className="mt-auto flex items-end justify-between gap-3 pt-4">
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
          {regions ? (
            <p className="mt-2 truncate text-xs text-muted">{regions}</p>
          ) : null}
        </div>
      </Link>
      {hasSeriesLink && laterDates.length > 0 ? (
        <details className="group/years mt-2">
          <summary
            aria-label={`More years for ${event.seriesTitle || event.title}`}
            className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-lg text-sm text-amber hover:text-paper [&::-webkit-details-marker]:hidden"
          >
            <span>More years</span>
            <Icon
              name="chevron"
              size={14}
              className="transition-transform group-open/years:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="pb-1 pt-1">
            <ul
              className="flex flex-wrap gap-1.5"
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
                      className="chip bg-surface !min-h-9 !px-3 font-mono text-xs"
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
              className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm text-paper-dim hover:text-paper"
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
          className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-sm text-amber hover:text-paper"
        >
          <span>All dates</span>
          <Icon name="arrow" size={14} aria-hidden="true" />
        </Link>
      ) : null}
      <div className="pointer-events-none absolute start-3 top-3 z-10">
        <CardHype event={event} points={event.hype} />
      </div>
      {showSave ? (
        <div className="absolute end-3 top-3 z-10">
          <SaveButton id={event.id} event={event} compact />
        </div>
      ) : null}
    </article>
  );
}
