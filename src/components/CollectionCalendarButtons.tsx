"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  googleCalendarFeedUrl,
  outlookCalendarFeedUrl,
} from "@/lib/calendar";
import { ANALYTICS_EVENTS, capture } from "@/lib/analytics";
import { Icon } from "./Icon";

const VIEWPORT_PAD = 12;

/** Horizontal shift that keeps [left, right] inside the viewport with a little air. */
export function keepMenuInViewport(
  left: number,
  right: number,
  viewportWidth: number,
  pad = VIEWPORT_PAD,
): number {
  let dx = 0;
  if (right > viewportWidth - pad) dx -= right - (viewportWidth - pad);
  if (left + dx < pad) dx += pad - (left + dx);
  return dx;
}

/** Subscribe Google/Outlook to the hosted feed, or download a snapshot .ics. */
export function CollectionCalendarButtons({
  title,
  icsUrl,
  eventCount,
  filename,
  align = "start",
}: {
  title: string;
  icsUrl: string;
  eventCount: number;
  filename: string;
  align?: "start" | "end";
}) {
  function award(provider: "google" | "outlook" | "ics") {
    capture(ANALYTICS_EVENTS.calendarAdded, {
      provider,
      scope: "collection",
      title,
      event_count: eventCount,
    });
  }
  const details = useRef<HTMLDetailsElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

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

  useLayoutEffect(() => {
    const el = menu.current;
    if (!open || !el) return;
    function pin() {
      if (!el) return;
      el.style.transform = "";
      const rect = el.getBoundingClientRect();
      const dx = keepMenuInViewport(rect.left, rect.right, window.innerWidth);
      el.style.transform = dx ? `translateX(${dx}px)` : "";
    }
    pin();
    window.addEventListener("resize", pin);
    return () => {
      window.removeEventListener("resize", pin);
      el.style.transform = "";
    };
  }, [open]);

  if (eventCount < 1) return null;
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
        <Icon name="calendar" size={17} /> Add all to calendar
        <span
          aria-hidden="true"
          className="ml-1 text-muted transition-transform group-open/calendar:rotate-180"
        >
          ⌄
        </span>
      </summary>
      <div
        ref={menu}
        className={`absolute top-full z-40 mt-2 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-line bg-ink-2 p-2 shadow-2xl ${
          align === "end"
            ? "left-0 max-sm:right-auto sm:left-auto sm:right-0"
            : "left-0"
        }`}
      >
        <p className="px-3 py-2 text-xs text-muted">
          {eventCount === 1
            ? "Adds the dated countdown in this collection"
            : `Adds all ${eventCount} dated countdowns`}
        </p>
        <a
          href={googleCalendarFeedUrl(icsUrl)}
          target="_blank"
          rel="noreferrer"
          onClick={() => award("google")}
          className="flex min-h-11 items-center justify-between rounded-xl px-3 text-sm text-paper hover:bg-amber/10 hover:text-amber"
        >
          Google Calendar <Icon name="arrow" size={15} />
        </a>
        <a
          href={outlookCalendarFeedUrl(icsUrl, title)}
          target="_blank"
          rel="noreferrer"
          onClick={() => award("outlook")}
          className="flex min-h-11 items-center justify-between rounded-xl px-3 text-sm text-paper hover:bg-amber/10 hover:text-amber"
        >
          Outlook <Icon name="arrow" size={15} />
        </a>
        <a
          href={icsUrl}
          download={filename}
          onClick={() => award("ics")}
          className="flex min-h-11 items-center rounded-xl px-3 text-sm text-paper hover:bg-amber/10 hover:text-amber"
        >
          Download .ics file
        </a>
        <p className="px-3 py-2 text-xs leading-relaxed text-muted">
          Google and Outlook keep the list updated. Use the file with Apple
          Calendar or another calendar app.
        </p>
      </div>
    </details>
  );
}
