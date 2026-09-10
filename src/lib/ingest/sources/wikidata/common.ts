/** Helpers shared by both phases of the `wikidata` adapter (re-exported from `../wikidata`). */

export const WD_ENDPOINT = "https://query.wikidata.org/sparql";

export type SparqlBinding = Record<string, { type: string; value: string; datatype?: string } | undefined>;

export function enwikiTitle(articleUrl?: string): string | undefined {
  if (!articleUrl) return undefined;
  try {
    const path = new URL(articleUrl).pathname.replace(/^\/wiki\//, "");
    const title = decodeURIComponent(path).replace(/_/g, " ").trim();
    return title || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Drop labels that mention a different year than the date (e.g. "Expo 2030" dated 2027).
 * A season range such as "2025–26" or "2026–2027" is consistent when the year falls inside it.
 */
export function labelYearConsistent(label: string, dateYear: number): boolean {
  const ranges: Array<[number, number]> = [];
  const rest = String(label).replace(/\b((?:19|20|21)\d{2})\s*[–—-]\s*(\d{4}|\d{2})\b/g, (_, a: string, b: string) => {
    const start = Number(a);
    let end = b.length === 4 ? Number(b) : Number(a.slice(0, 2) + b);
    if (end < start) end += 100;
    ranges.push([start, end]);
    return " ";
  });
  const years = rest.match(/\b(19|20|21)\d{2}\b/g) ?? [];
  if (!years.length && !ranges.length) return true;
  return years.every((y) => Number(y) === dateYear) && ranges.every(([s, e]) => dateYear >= s && dateYear <= e);
}
