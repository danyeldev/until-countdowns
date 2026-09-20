"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  googleCalendarFeedUrl,
  hostedCalendarUrl,
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

function isCoarsePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

/** Subscribe Google/Outlook to the hosted feed, or download a snapshot .ics. */
export function CollectionCalendarButtons({
  title,
  icsPath,
  eventCount,
  filename,
  align = "start",
}: {
  title: string;
  icsPath: string;
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
  const [icsUrl, setIcsUrl] = useState(icsPath);

  useEffect(() => {
    setIcsUrl(hostedCalendarUrl(icsPath));
  }, [icsPath]);

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

  const feedUrl = icsUrl.startsWith("http") ? icsUrl : "";
  const googleHref = googleCalendarFeedUrl(feedUrl);
  const outlookHref = outlookCalendarFeedUrl(feedUrl, title);

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
          href={googleHref}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => {
            award("google");
            const href = googleCalendarFeedUrl(hostedCalendarUrl(icsPath));
            if (!href || href === "#") {
              event.preventDefault();
              return;
            }
            // A new tab on a phone skips the Google Calendar app's universal link
            // and opens the desktop add-calendar page, which then rejects the URL.
            if (isCoarsePointer()) {
              event.preventDefault();
              window.location.assign(href);
            }
          }}
          className="flex min-h-11 items-center justify-between rounded-xl px-3 text-sm text-paper hover:bg-amber/10 hover:text-amber"
        >
          Google Calendar <Icon name="arrow" size={15} />
        </a>
        <a
          href={outlookHref}
          target="_blank"
          rel="noreferrer"
          onClick={() => award("outlook")}
          className="flex min-h-11 items-center justify-between rounded-xl px-3 text-sm text-paper hover:bg-amber/10 hover:text-amber"
        >
          Outlook <Icon name="arrow" size={15} />
        </a>
        <a
          href={icsPath}
          download={filename}
          onClick={() => award("ics")}
          className="flex min-h-11 items-center rounded-xl px-3 text-sm text-paper hover:bg-amber/10 hover:text-amber"
        >
          Download .ics file
        </a>
        <p className="px-3 py-2 text-xs leading-relaxed text-muted">
          Google and Outlook subscribe to this list. On a phone, download the
          file to open it in the Google Calendar app if the link stays in the
          browser.
        </p>
      </div>
    </details>
  );
}
