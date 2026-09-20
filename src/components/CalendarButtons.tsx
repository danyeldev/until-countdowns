"use client";

import { useEffect, useRef, useState } from "react";
import type { CountdownEvent } from "@/lib/types";
import {
  canAddToCalendar,
  downloadIcs,
  googleCalendarUrl,
  outlookCalendarUrl,
} from "@/lib/calendar";
import { ANALYTICS_EVENTS, capture, captureException } from "@/lib/analytics";
import { recordHype } from "@/lib/hype-client";
import { Icon } from "./Icon";

/** Caller-provided URLs preserve the portable share or evergreen series destination. */
export function CalendarButtons({
  event,
  url,
  hypeKey,
}: {
  event: CountdownEvent;
  url?: string;
  hypeKey?: string | null;
}) {
  function award(provider: "google" | "outlook" | "ics") {
    capture(ANALYTICS_EVENTS.calendarAdded, {
      provider,
      event_id: event.id,
      slug: event.slug,
      title: event.title,
      category: event.category,
    });
    if (hypeKey) void recordHype(hypeKey, "calendar");
  }
  const details = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    function dismiss(e: PointerEvent) {
      if (
        e.target instanceof Node &&
        !details.current?.contains(e.target) &&
        details.current
      )
        details.current.open = false;
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  if (!canAddToCalendar(event)) return null;
  return (
    <details
      ref={details}
      className="group/calendar relative"
      onToggle={(e) => setOpen(e.currentTarget.open)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && details.current?.open) {
          details.current.open = false;
          details.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary className="button-secondary cursor-pointer list-none gap-2 [&::-webkit-details-marker]:hidden">
        <Icon name="calendar" size={17} /> Add to calendar
        <span
          aria-hidden="true"
          className="ml-1 text-muted transition-transform group-open/calendar:rotate-180"
        >
          ⌄
        </span>
      </summary>
      <div className="absolute top-full left-0 z-40 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-2xl border border-line bg-ink-2 p-2 shadow-2xl">
        <p className="px-3 py-2 text-xs text-muted">Choose your calendar</p>
        <a
          href={googleCalendarUrl(event, url)}
          target="_blank"
          rel="noreferrer"
          onClick={() => award("google")}
          className="flex min-h-11 items-center justify-between rounded-xl px-3 text-sm text-paper hover:bg-amber/10 hover:text-amber"
        >
          Google Calendar <Icon name="arrow" size={15} />
        </a>
        <a
          href={outlookCalendarUrl(event, url)}
          target="_blank"
          rel="noreferrer"
          onClick={() => award("outlook")}
          className="flex min-h-11 items-center justify-between rounded-xl px-3 text-sm text-paper hover:bg-amber/10 hover:text-amber"
        >
          Outlook <Icon name="arrow" size={15} />
        </a>
        <button
          type="button"
          className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm text-paper hover:bg-amber/10 hover:text-amber"
          onClick={() => {
            try {
              downloadIcs(event, url);
              award("ics");
              setError("");
            } catch (cause) {
              captureException(cause, { action: "calendar_ics" });
              setError(
                "The download couldn’t start. Try a calendar link above.",
              );
            }
          }}
        >
          Download .ics file
        </button>
        <p className="px-3 py-2 text-xs leading-relaxed text-muted">
          Use the file with Apple Calendar or another calendar app.
        </p>
        {error ? (
          <p role="alert" className="px-3 py-2 text-xs text-ember">
            {error}
          </p>
        ) : null}
      </div>
    </details>
  );
}
