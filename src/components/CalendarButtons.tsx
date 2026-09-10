"use client";

import type { CountdownEvent } from "@/lib/types";
import { downloadIcs, googleCalendarUrl, outlookCalendarUrl } from "@/lib/calendar";

/**
 * `url` is the page the calendar entry should link back to. It defaults to the event's own page,
 * but a shared personal countdown lives at its payload URL and a series at its evergreen one, so
 * the caller that already knows which says so.
 */
export function CalendarButtons({ event, url }: { event: CountdownEvent; url?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={googleCalendarUrl(event, url)}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-line px-4 py-2 text-sm text-paper hover:border-amber/50 hover:text-amber"
      >
        Google Calendar
      </a>
      <a
        href={outlookCalendarUrl(event, url)}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-line px-4 py-2 text-sm text-paper hover:border-amber/50 hover:text-amber"
      >
        Outlook
      </a>
      <button
        type="button"
        onClick={() => downloadIcs(event, url)}
        className="rounded-full border border-line px-4 py-2 text-sm text-paper hover:border-amber/50 hover:text-amber"
      >
        Download .ics
      </button>
    </div>
  );
}
