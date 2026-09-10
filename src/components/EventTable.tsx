import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/labels";
import { formatShortDate } from "@/lib/seo";
import { formatApproximate, humanDays, isCoarsePrecision } from "@/lib/time";
import type { CountdownEvent } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

/** Compact dated list used by hubs and the series dates table. Server-rendered, no ticking. */
export function EventTable({
  events,
  showCategory = true,
  emptyText = "Nothing scheduled here yet.",
}: {
  events: CountdownEvent[];
  showCategory?: boolean;
  emptyText?: string;
}) {
  if (events.length === 0) return <p className="mt-4 text-sm text-muted">{emptyText}</p>;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-muted">
            <th className="py-2 pr-4 font-normal">Date</th>
            <th className="py-2 pr-4 font-normal">Event</th>
            <th className="py-2 pr-4 font-normal">In</th>
            {showCategory ? <th className="py-2 font-normal">Category</th> : null}
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const coarse = isCoarsePrecision(event.datePrecision);
            return (
              <tr key={event.id} className="border-t border-line/60 align-top">
                <td className="whitespace-nowrap py-2.5 pr-4 font-mono text-xs text-muted">
                  <time dateTime={event.date}>
                    {coarse ? formatApproximate(event.date, event.datePrecision) : formatShortDate(event.date)}
                  </time>
                </td>
                <td className="py-2.5 pr-4">
                  <Link href={`/event/${event.slug}`} className="text-paper hover:text-amber">
                    {event.title}
                  </Link>
                  <StatusBadge status={event.status} className="ml-2" />
                </td>
                <td className="tabular whitespace-nowrap py-2.5 pr-4 font-mono text-xs text-paper-dim">
                  {coarse ? "" : humanDays(event.daysUntil)}
                </td>
                {showCategory ? (
                  <td className="whitespace-nowrap py-2.5 text-xs">
                    <Link href={`/category/${event.category}`} className="text-muted hover:text-paper">
                      {CATEGORY_LABELS[event.category]}
                    </Link>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
