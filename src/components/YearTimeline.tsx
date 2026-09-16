import { Link } from "@/i18n/navigation";
import {
  catalogDay,
  formatApproximate,
  formatCompactDate,
  isCoarsePrecision,
} from "@/lib/time";
import type { CountdownEvent } from "@/lib/types";
import { Icon } from "./Icon";
import { StatusBadge } from "./StatusBadge";

/** Each year remains a real dated URL; approximate entries never claim a placeholder day. */
export function YearTimeline({
  events,
  currentSlug,
}: {
  events: CountdownEvent[];
  currentSlug?: string;
}) {
  if (!events.length) return null;
  return (
    <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
      {events.map((event) => {
        const current = event.slug === currentSlug;
        const coarse = isCoarsePrecision(event.datePrecision);
        const label = coarse
          ? formatApproximate(event.date, event.datePrecision)
          : formatCompactDate(event.date, event.timezone);
        return (
          <li key={event.id}>
            <Link
              href={`/event/${event.slug}`}
              aria-label={`${event.title}, ${label}`}
              aria-current={current ? "page" : undefined}
              className={`group flex h-full flex-col rounded-2xl border p-4 transition-colors ${current ? "border-amber/50 bg-amber/10" : "border-line bg-ink-2 hover:border-amber/50 hover:bg-amber/5"}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span
                  className={`text-xl font-semibold tabular-nums tracking-tight ${current ? "text-amber" : "text-paper"}`}
                >
                  {catalogDay(event.date, event.timezone).slice(0, 4)}
                </span>
                <Icon
                  name={current ? "check" : "arrow"}
                  size={16}
                  className={
                    current ? "text-amber" : "text-muted group-hover:text-amber"
                  }
                />
              </span>
              <span className="mt-2 text-sm text-paper-dim">
                {coarse ? label : <time dateTime={event.date}>{label}</time>}
              </span>
              {event.status && event.status !== "scheduled" ? (
                <StatusBadge
                  status={event.status}
                  className="mt-2 self-start"
                />
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
