"use client";

import type { CountdownEvent } from "@/lib/types";
import { downloadIcs, googleCalendarUrl, outlookCalendarUrl } from "@/lib/calendar";

export function CalendarButtons({ event }: { event: CountdownEvent }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={googleCalendarUrl(event)}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-line px-4 py-2 text-sm text-paper hover:border-amber/50 hover:text-amber"
      >
        Google Calendar
      </a>
      <a
        href={outlookCalendarUrl(event)}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-line px-4 py-2 text-sm text-paper hover:border-amber/50 hover:text-amber"
      >
        Outlook
      </a>
      <button
        type="button"
        onClick={() => downloadIcs(event)}
        className="rounded-full border border-line px-4 py-2 text-sm text-paper hover:border-amber/50 hover:text-amber"
      >
        Download .ics
      </button>
    </div>
  );
}
