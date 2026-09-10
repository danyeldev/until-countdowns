import { expectedPeriod, formatLongDate } from "@/lib/seo";
import { isCoarsePrecision } from "@/lib/time";
import type { DatePrecision } from "@/lib/types";

/**
 * The one server-rendered sentence that answers the query behind the page
 * ("how many days until X?") with the SQL-computed day count, so the answer is in the HTML
 * before any client clock runs. Digits are tabular so the sentence never reflows.
 */
export function IntentAnswer({
  title,
  date,
  days,
  precision,
  status,
  className = "",
}: {
  title: string;
  date: string;
  days?: number | null;
  precision?: DatePrecision | null;
  status?: string | null;
  className?: string;
}) {
  let text: string;
  if (isCoarsePrecision(precision)) {
    text = `${title} is expected ${expectedPeriod(date, precision)}. The exact day has not been announced yet.`;
  } else if (status === "cancelled") {
    text = `${title} was scheduled for ${formatLongDate(date)} and has been cancelled.`;
  } else if (typeof days !== "number" || !Number.isFinite(days)) {
    text = `${title} is on ${formatLongDate(date)}.`;
  } else if (days === 0) {
    text = `${title} is today, ${formatLongDate(date)}.`;
  } else if (days === 1) {
    text = `There is 1 day until ${title}, tomorrow, ${formatLongDate(date)}.`;
  } else if (days < 0) {
    const ago = Math.abs(days);
    text = `${title} was ${ago.toLocaleString("en-US")} ${ago === 1 ? "day" : "days"} ago, on ${formatLongDate(date)}.`;
  } else {
    text = `There are ${days.toLocaleString("en-US")} days until ${title}, on ${formatLongDate(date)}.`;
  }
  return <p className={`tabular text-base text-paper-dim sm:text-lg ${className}`}>{text}</p>;
}
