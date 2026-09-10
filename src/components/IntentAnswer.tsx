import { i18n } from "@/lib/i18n/server";
import { expectedPeriod, formatLongDate } from "@/lib/seo";
import { isCoarsePrecision } from "@/lib/time";
import type { DatePrecision } from "@/lib/types";

/**
 * The one server-rendered sentence that answers the query behind the page
 * ("how many days until X?") with the SQL-computed day count, so the answer is in the HTML
 * before any client clock runs. Digits are tabular so the sentence never reflows.
 *
 * Each case is a whole template from the catalogue rather than a sentence assembled from pieces:
 * this is the string the result snippet is built from, and a clause that reads as a translation
 * is a clause nobody searched for. `title` arrives already localized — the caller knows whether
 * the entity has a curated name.
 */
export async function IntentAnswer({
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
  const L = await i18n();
  const a = L.m.event.answer;
  const when = formatLongDate(L, date);
  let text: string;
  if (isCoarsePrecision(precision)) {
    text = L.t(a.coarse, { title, period: expectedPeriod(L, date, precision) });
  } else if (status === "cancelled") {
    text = L.t(a.cancelled, { title, date: when });
  } else if (typeof days !== "number" || !Number.isFinite(days)) {
    text = L.t(a.plain, { title, date: when });
  } else if (days === 0) {
    text = L.t(a.today, { title, date: when });
  } else if (days === 1) {
    text = L.tn(a.tomorrow, 1, { title, date: when });
  } else if (days < 0) {
    text = L.tn(a.past, Math.abs(days), { title, date: when });
  } else {
    text = L.tn(a.days, days, { title, date: when });
  }
  return <p className={`tabular text-base text-paper-dim sm:text-lg ${className}`}>{text}</p>;
}
