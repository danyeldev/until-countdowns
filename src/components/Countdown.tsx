"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  formatApproximate,
  isCoarsePrecision,
  localDateString,
  remainingUntil,
} from "@/lib/time";
import type { DatePrecision, EventStatus } from "@/lib/types";
import { useNow } from "@/lib/use-now";

const PLACEHOLDER = "--";
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
function initialDayFigure(
  initialDays: number | null | undefined,
  allDay: boolean,
): number | null {
  if (typeof initialDays !== "number" || !Number.isFinite(initialDays))
    return null;
  return Math.max(0, allDay ? initialDays - 1 : initialDays);
}

export function Countdown({
  date,
  allDay = true,
  size = "card",
  initialDays,
  precision,
  status,
}: {
  date: string;
  allDay?: boolean;
  size?: "card" | "hero";
  /** Whole days until the event as computed by SQL at render time; shown until the client clock is live. */
  initialDays?: number | null;
  precision?: DatePrecision | null;
  status?: EventStatus;
}) {
  const now = useNow();
  const huge = size === "hero";
  const locale = useLocale();
  const t = useTranslations("countdown");

  if (
    status === "cancelled" ||
    status === "postponed" ||
    status === "retired" ||
    status === "done"
  ) {
    return (
      <p
        className={`font-medium tracking-tight text-muted ${huge ? "text-3xl" : "text-lg"}`}
      >
        {status === "cancelled"
          ? t("cancelled")
          : status === "postponed"
            ? t("postponed")
            : status === "retired"
              ? t("retired")
              : t("passed")}
      </p>
    );
  }

  if (isCoarsePrecision(precision)) {
    return (
      <p
        className={`font-medium tracking-tight text-amber ${huge ? "text-3xl sm:text-4xl" : "text-lg"}`}
      >
        {formatApproximate(date, precision, locale)}
      </p>
    );
  }

  const dateOnly = allDay && !date.includes("T");
  const live = now !== null ? remainingUntil(date, allDay, now) : null;

  // An all-day event on its own day: the clock has reached midnight but the day is not over.
  // Server-side that is SQL `days_until === 0`; client-side, the local date equals the event date.
  const today =
    dateOnly &&
    (live
      ? live.past && localDateString(now as number) === date.slice(0, 10)
      : initialDays === 0);

  if (today) {
    return (
      <p
        className={`font-medium tracking-tight text-amber ${huge ? "text-4xl sm:text-5xl" : "text-xl"}`}
        data-live={live ? "true" : "false"}
      >
        {t("today")}
      </p>
    );
  }

  const past = live
    ? live.past
    : typeof initialDays === "number" && initialDays < 0;

  if (past) {
    return (
      <p
        className={`font-medium tracking-tight text-muted ${huge ? "text-2xl" : "text-sm"}`}
      >
        {t("passed")}
      </p>
    );
  }

  const days = live ? live.days : initialDayFigure(initialDays, allDay);
  const daysText = days === null ? PLACEHOLDER : pad(days);
  const hours = live ? pad(live.hours) : PLACEHOLDER;
  const minutes = live ? pad(live.minutes) : PLACEHOLDER;
  const seconds = live ? pad(live.seconds) : PLACEHOLDER;

  return (
    <div
      className={`timer ${huge ? "timer-hero" : "timer-card"}`}
      aria-live="off"
      data-live={live ? "true" : "false"}
    >
      <div className="timer-days">
        <span className="timer-major">{daysText}</span>
        <span className="timer-days-label">{t("day", { count: days ?? 0 })}</span>
      </div>
      <div
        className="timer-clock"
        role="group"
        aria-label={t("clockAria", { hours, minutes, seconds })}
      >
        {[
          [hours, t("hours")],
          [minutes, t("minutes")],
          [seconds, t("seconds")],
        ].map(([value, label], index) => (
          <div key={label} className="flex items-start gap-1">
            {!huge && index > 0 && (
              <span aria-hidden="true" className="text-xs">
                :
              </span>
            )}
            <div aria-hidden="true">
              <p className="timer-clock-value">{value}</p>
              <p className="timer-clock-label">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
