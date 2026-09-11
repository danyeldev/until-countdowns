import Link from "next/link";
import { i18n } from "@/lib/i18n/server";
import { displayTitle, formatApproximate } from "@/lib/seo";
import { isCoarsePrecision } from "@/lib/time";
import type { CountdownEvent } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

/**
 * Compact dated list used by hubs and the series dates table. Server-rendered, no ticking.
 *
 * Reads the locale itself, so a hub passes rows and nothing else; `emptyText` stays a prop because
 * each hub says its own thing when it has no dates, and hands over a string already translated.
 */
export async function EventTable({
  events,
  showCategory = true,
  emptyText,
}: {
  events: CountdownEvent[];
  showCategory?: boolean;
  emptyText?: string;
}) {
  const L = await i18n();
  if (events.length === 0) return <p className="mt-4 text-sm text-muted">{emptyText ?? L.m.home.table.empty}</p>;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-start text-[11px] uppercase tracking-[0.16em] text-muted">
            <th className="py-2 pe-4 font-normal">{L.m.home.table.date}</th>
            <th className="py-2 pe-4 font-normal">{L.m.home.table.event}</th>
            <th className="py-2 pe-4 font-normal">{L.m.home.table.within}</th>
            {showCategory ? <th className="py-2 font-normal">{L.m.home.table.category}</th> : null}
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const coarse = isCoarsePrecision(event.datePrecision);
            return (
              <tr key={event.id} className="border-t border-line/60 align-top">
                <td className="whitespace-nowrap py-2.5 pe-4 font-mono text-xs text-muted">
                  <time dateTime={event.date}>
                    {coarse
                      ? formatApproximate(L, event.date, event.datePrecision)
                      : L.fmt.shortDate(event.date, event.timezone)}
                  </time>
                </td>
                <td className="py-2.5 pe-4">
                  <Link href={L.href(`/event/${event.slug}`)} className="text-paper hover:text-amber">
                    {displayTitle(L, event)}
                  </Link>
                  <StatusBadge status={event.status} className="ms-2" />
                </td>
                <td className="tabular whitespace-nowrap py-2.5 pe-4 font-mono text-xs text-paper-dim">
                  {coarse ? "" : L.fmt.humanDays(event.daysUntil)}
                </td>
                {showCategory ? (
                  <td className="whitespace-nowrap py-2.5 text-xs">
                    <Link href={L.href(`/category/${event.category}`)} className="text-muted hover:text-paper">
                      {L.m.categories.labels[event.category]}
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
