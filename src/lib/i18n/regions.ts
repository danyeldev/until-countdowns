/**
 * Country names in the reader's language.
 *
 * `src/lib/regions.ts` stays English on purpose: the ingest adapters match feed text against
 * `COUNTRY_NAMES` ("United States" in a Liquipedia page, a confs.tech country field), and a
 * translated table there would break every one of them. So display goes through here instead,
 * where `Intl.DisplayNames` supplies the name — 250 countries in fifteen languages, from ICU,
 * with nothing to maintain and nothing to get wrong.
 *
 * `COUNTRY_NAMES` is still the fallback: it carries a handful of codes ICU declines to name, and
 * the `GLOBAL` pseudo-region, which is a word rather than a place.
 */
import type { Localized } from "./bind";
import { COUNTRY_NAMES } from "../regions";

/** "Spain" · "España" · "Worldwide" for the `GLOBAL` pseudo-region. */
export function regionLabel(L: Localized, code: string): string {
  if (code === "GLOBAL") return L.m.common.labels.worldwide;
  return L.fmt.countryName(code, COUNTRY_NAMES[code] || code);
}

/** "Spain · France · Italy +4" · "12 countries" · "Worldwide". */
export function regionSummary(L: Localized, regions: string[], limit = 3): string {
  const worldwide = L.m.common.labels.worldwide;
  if (regions.includes("GLOBAL") && regions.length === 1) return worldwide;
  if (regions.length > 12) return L.tn(L.m.common.labels.countriesCount, regions.length);
  const names = regions.filter((r) => r !== "GLOBAL").map((code) => regionLabel(L, code));
  if (names.length === 0) return worldwide;
  if (names.length <= limit) return names.join(" · ");
  return `${names.slice(0, limit).join(" · ")} +${L.fmt.number(names.length - limit)}`;
}
