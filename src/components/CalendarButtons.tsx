"use client";

import { useEffect, useRef, useState } from "react";
import type { CountdownEvent } from "@/lib/types";
import {
  canAddToCalendar,
  downloadIcs,
  googleCalendarUrl,
  outlookCalendarUrl,
} from "@/lib/calendar";
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
  function award() {
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
      <div className="menu absolute top-full start-0 z-40 mt-2 w-64 max-w-[calc(100vw-3rem)]">
        <p className="px-3 py-2 text-xs text-muted">Choose your calendar</p>
        <a
          href={googleCalendarUrl(event, url)}
          target="_blank"
          rel="noreferrer"
          onClick={award}
          className="menu-item justify-between"
        >
          Google Calendar <Icon name="arrow" size={15} />
        </a>
        <a
          href={outlookCalendarUrl(event, url)}
          target="_blank"
          rel="noreferrer"
          onClick={award}
          className="menu-item justify-between"
        >
          Outlook <Icon name="arrow" size={15} />
        </a>
        <button
          type="button"
          className="menu-item"
          onClick={() => {
            try {
              downloadIcs(event, url);
              award();
              setError("");
            } catch {
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
