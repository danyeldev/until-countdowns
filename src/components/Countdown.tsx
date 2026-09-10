"use client";

import type { Locale } from "@/lib/i18n/config";
import { plural, type PluralForms } from "@/lib/i18n/messages/types";
import { isCoarsePrecision, localDateString, remainingUntil } from "@/lib/time";
import type { DatePrecision } from "@/lib/types";
import { useNow } from "@/lib/use-now";

const PLACEHOLDER = "--";
/** Width reserved for the days cell when no server figure is known (personal countdowns): fits up to 999. */
const UNKNOWN_DAYS_CHARS = 3;

/** The clock's own words, handed over by the server parent as `L.m.embed.countdown`. */
type Labels = {
  units: { days: PluralForms; hours: string; minutes: string; seconds: string };
  today: string;
  past: string;
};

function Unit({
  value,
  label,
  huge,
  minChars = 2,
}: {
  value: string;
  label: string;
  huge?: boolean;
  minChars?: number;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <span
        className={`tabular amber-glow inline-block text-center font-mono tracking-tight text-amber ${
          huge ? "text-5xl sm:text-7xl md:text-8xl" : "text-2xl sm:text-3xl"
        }`}
        style={{ minWidth: `${Math.max(2, minChars)}ch` }}
      >
        {value}
      </span>
      <span className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted">{label}</span>
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * First-paint day figure that agrees with the live clock.
 *
 * SQL `days_until` is a calendar-day difference (`starts_on - current_date`, UTC). The live
 * clock for an all-day event counts down to local midnight at the START of that day, so its
 * days unit is `floor(ms / 1 day)` = calendar difference − 1 whenever hours > 0 (all day but
 * the exact midnight second). Timed events already use the same floor in SQL. The residual
 * ±1 for visitors far from UTC resolves on the first client tick.
 */
function initialDayFigure(initialDays: number | null | undefined, allDay: boolean): number | null {
  if (typeof initialDays !== "number" || !Number.isFinite(initialDays)) return null;
  return Math.max(0, allDay ? initialDays - 1 : initialDays);
}

export function Countdown({
  date,
  allDay = true,
  size = "card",
  initialDays,
  precision,
  locale,
  labels,
  approximate,
}: {
  date: string;
  allDay?: boolean;
  size?: "card" | "hero";
  /** Whole days until the event as computed by SQL at render time; shown until the client clock is live. */
  initialDays?: number | null;
  precision?: DatePrecision | null;
  /** Only for the plural rules below; every string this renders arrives ready-made. */
  locale: Locale;
  labels: Labels;
  /**
   * The "expected June 2027" line, from the parent's `formatApproximate(L, date, precision)`.
   * Required whenever `precision` can be coarse: there is no clock to run for a date that is only
   * known to the month, and the sentence needs a catalogue this side of the boundary cannot reach.
   */
  approximate?: string;
}) {
  const now = useNow();
  const huge = size === "hero";

  if (isCoarsePrecision(precision)) {
    return (
      <p className={`font-serif italic text-amber ${huge ? "text-3xl sm:text-4xl" : "text-lg"}`}>
        {approximate}
      </p>
    );
  }

  const dateOnly = allDay && !date.includes("T");
  const live = now !== null ? remainingUntil(date, allDay, now) : null;

  // An all-day event on its own day: the clock has reached midnight but the day is not over.
  // Server-side that is SQL `days_until === 0`; client-side, the local date equals the event date.
  const today = dateOnly && (live ? live.past && localDateString(now as number) === date.slice(0, 10) : initialDays === 0);

  if (today) {
    return (
      <p className={`font-serif italic text-amber ${huge ? "text-4xl sm:text-5xl" : "text-xl"}`} data-live={live ? "true" : "false"}>
        {labels.today}
      </p>
    );
  }

  const past = live ? live.past : typeof initialDays === "number" && initialDays < 0;

  if (past) {
    return (
      <p className={`font-serif italic text-muted ${huge ? "text-2xl" : "text-sm"}`}>
        {labels.past}
      </p>
    );
  }

  const days = live ? live.days : initialDayFigure(initialDays, allDay);
  const daysText = days === null ? PLACEHOLDER : pad(days);
  const daysChars = days === null ? UNKNOWN_DAYS_CHARS : Math.max(2, daysText.length);
  const hours = live ? pad(live.hours) : PLACEHOLDER;
  const minutes = live ? pad(live.minutes) : PLACEHOLDER;
  const seconds = live ? pad(live.seconds) : PLACEHOLDER;
  const sep = <span className={`pb-4 text-muted ${huge ? "text-4xl" : "text-lg"}`}>:</span>;

  // The day word is chosen here rather than handed down ready-made: the figure changes on every
  // tick and only the browser knows the live one. `PluralForms` is plain data, so it crosses the
  // boundary as a prop like any other message; the abbreviations below do not inflect.
  return (
    <div
      className={`flex items-end justify-between gap-3 ${huge ? "max-w-3xl" : ""}`}
      aria-live="off"
      data-live={live ? "true" : "false"}
    >
      <Unit
        value={daysText}
        label={plural(locale, labels.units.days, days ?? 0)}
        huge={huge}
        minChars={daysChars}
      />
      {sep}
      <Unit value={hours} label={labels.units.hours} huge={huge} />
      {sep}
      <Unit value={minutes} label={labels.units.minutes} huge={huge} />
      {sep}
      <Unit value={seconds} label={labels.units.seconds} huge={huge} />
    </div>
  );
}
