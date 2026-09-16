import { Link } from "@/i18n/navigation";
import { CATEGORY_LABELS } from "@/lib/labels";
import {
  catalogDay,
  formatApproximate,
  formatCompactDate,
  humanDays,
  isCoarsePrecision,
} from "@/lib/time";
import type { CountdownEvent } from "@/lib/types";
import { Icon } from "./Icon";
import { HypeLabel } from "./HypeLabel";
import { StatusBadge } from "./StatusBadge";

/** Responsive dated rows. All navigation is server rendered; the list never ticks. */
export function EventTable({
  events,
  showCategory = true,
  emptyText = "Nothing scheduled here yet.",
}: {
  events: CountdownEvent[];
  showCategory?: boolean;
  emptyText?: string;
}) {
  if (!events.length)
    return <p className="empty-state mt-4 text-sm text-muted">{emptyText}</p>;
  return (
    <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-ink-2">
      {events.map((event) => {
        const coarse = isCoarsePrecision(event.datePrecision);
        const dateLabel = coarse
          ? formatApproximate(event.date, event.datePrecision)
          : formatCompactDate(event.date, event.timezone);
        const counting =
          !coarse &&
          !["cancelled", "postponed", "retired"].includes(event.status ?? "");
        const day = catalogDay(event.date, event.timezone);
        return (
          <li
            key={event.id}
            className="group flex items-center gap-2 px-4 transition-colors hover:bg-amber/5 sm:px-5"
          >
            <Link
              href={`/event/${event.slug}`}
              className="grid min-w-0 flex-1 grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-3 py-4 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:gap-4"
            >
              <span
                aria-hidden="true"
                className="flex h-14 flex-col items-center justify-center rounded-xl border border-line bg-ink text-paper"
              >
                {coarse ? (
                  <Icon name="calendar" size={20} className="text-muted" />
                ) : (
                  <>
                    <span className="text-[11px] font-medium text-muted">
                      {new Intl.DateTimeFormat("en", {
                        month: "short",
                        timeZone: "UTC",
                      }).format(new Date(`${day}T00:00:00Z`))}
                    </span>
                    <span className="text-xl leading-tight font-semibold tabular-nums">
                      {Number(day.slice(8, 10))}
                    </span>
                  </>
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-paper group-hover:text-amber sm:text-base">
                  {event.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {coarse ? (
                    <span>{dateLabel}</span>
                  ) : (
                    <time dateTime={event.date}>{dateLabel}</time>
                  )}
                  <StatusBadge status={event.status} />
                  <HypeLabel points={event.hype} />
                </span>
              </span>
              {counting ? (
                <span className="hidden text-sm whitespace-nowrap text-paper-dim tabular-nums sm:block">
                  {humanDays(event.daysUntil)}
                </span>
              ) : null}
            </Link>
            {showCategory ? (
              <Link
                href={`/category/${event.category}`}
                className="inline-flex min-h-11 max-w-24 shrink-0 items-center rounded-lg px-2 text-xs text-muted hover:text-amber sm:px-3"
              >
                {CATEGORY_LABELS[event.category]}
              </Link>
            ) : null}
            <Icon
              name="arrow"
              size={16}
              className="shrink-0 text-muted group-hover:text-amber"
            />
          </li>
        );
      })}
    </ul>
  );
}
