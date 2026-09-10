"use client";

import type { CountdownEvent } from "@/lib/types";
import { downloadIcs, googleCalendarUrl, outlookCalendarUrl } from "@/lib/calendar";

/** The three button words, taken straight from `L.m.common.actions` by the server parent. */
type Labels = { google: string; outlook: string; downloadIcs: string };

/**
 * `url` is the page the calendar entry should link back to. It defaults to the event's own page,
 * but a shared personal countdown lives at its payload URL and a series at its evergreen one, so
 * the caller that already knows which says so.
 *
 * Only the labels are translated. What the buttons produce — the `.ics` body, the Google and
 * Outlook payloads — stays English: it is read months later inside whatever calendar the reader
 * keeps, which is not this page and has no idea what locale it was created from.
 */
export function CalendarButtons({ event, url, labels }: { event: CountdownEvent; url?: string; labels: Labels }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={googleCalendarUrl(event, url)}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-line px-4 py-2 text-sm text-paper hover:border-amber/50 hover:text-amber"
      >
        {labels.google}
      </a>
      <a
        href={outlookCalendarUrl(event, url)}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-line px-4 py-2 text-sm text-paper hover:border-amber/50 hover:text-amber"
      >
        {labels.outlook}
      </a>
      <button
        type="button"
        onClick={() => downloadIcs(event, url)}
        className="rounded-full border border-line px-4 py-2 text-sm text-paper hover:border-amber/50 hover:text-amber"
      >
        {labels.downloadIcs}
      </button>
    </div>
  );
}
