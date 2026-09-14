import type { CountdownEvent, SeriesOccurrencePreview } from "./types";

function scope(event: CountdownEvent): string {
  return JSON.stringify([event.seriesSlug, [...new Set(event.regions)].sort()]);
}

/** Preserve regional variants and only offer dates later than the displayed occurrence. */
export function groupFutureOccurrences(
  events: readonly CountdownEvent[],
  candidates: readonly CountdownEvent[],
  limit = 4,
): Record<string, SeriesOccurrencePreview[]> {
  const result: Record<string, SeriesOccurrencePreview[]> = {};
  const sorted = [...candidates]
    .filter(
      (event) =>
        Number.isFinite(Date.parse(event.date)) &&
        !["cancelled", "retired", "done"].includes(event.status ?? ""),
    )
    .sort(
      (a, b) =>
        Date.parse(a.date) - Date.parse(b.date) || a.slug.localeCompare(b.slug),
    );
  for (const event of events) {
    if (!event.seriesSlug) continue;
    const key = scope(event);
    const seen = new Set<string>();
    result[event.id] = sorted
      .filter((candidate) => {
        if (
          scope(candidate) !== key ||
          Date.parse(candidate.date) <= Date.parse(event.date)
        )
          return false;
        if (seen.has(candidate.date)) return false;
        seen.add(candidate.date);
        return true;
      })
      .slice(0, Math.max(0, limit))
      .map(({ slug, title, date, timezone, datePrecision }) => ({
        slug,
        title,
        date,
        timezone,
        datePrecision,
      }));
  }
  return result;
}
