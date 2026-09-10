import { describe, expect, it } from "vitest";
import { bind } from "@/lib/i18n/bind";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/config";
import { EN } from "@/lib/i18n/messages/en";
import {
  buildMetadata,
  categoryTitle,
  daysSentence,
  eventDescription,
  eventTitle,
  expectedPeriod,
  seriesDescription,
  seriesHeading,
  seriesTitle,
  tagTitle,
} from "@/lib/seo";
import type { CountdownEvent, Series } from "@/lib/types";

/** The catalogues are behind a `server-only` registry; a page's `L` is this shape either way. */
const L = (locale: Locale = "en") => ({ ...bind(locale), m: EN });

const EVENT: Pick<CountdownEvent, "title" | "date" | "category" | "datePrecision" | "daysUntil" | "status"> & {
  slug: string;
} = {
  slug: "christmas-day-2026-12-25",
  title: "Christmas Day",
  date: "2026-12-25",
  category: "holidays",
  datePrecision: "day",
  daysUntil: 107,
  status: "scheduled",
};

const SERIES: Pick<Series, "title" | "nextDate" | "nextPrecision" | "daysUntil"> & { slug: string } = {
  slug: "christmas-day",
  title: "Christmas Day",
  nextDate: "2026-12-25",
  nextPrecision: "day",
  daysUntil: 107,
};

describe("titles and descriptions", () => {
  it("keep the pre-i18n English wording", () => {
    expect(eventTitle(L(), EVENT)).toBe("When is Christmas Day? Friday, 25 December 2026");
    expect(eventDescription(L(), EVENT)).toBe(
      "Christmas Day is on Friday, 25 December 2026. That is 107 days away. Live countdown, add to calendar.",
    );
    expect(seriesTitle(L(), SERIES)).toBe("How many days until Christmas Day? — Friday, 25 December 2026");
    expect(seriesHeading(L(), SERIES)).toBe("How many days until Christmas Day?");
    expect(seriesDescription(L(), SERIES)).toBe(
      "Christmas Day is on Friday, 25 December 2026. That is 107 days away. Live countdown, dates for every year, add to calendar.",
    );
    expect(categoryTitle(L(), "sports")).toBe("Upcoming sports — countdowns and dates");
    expect(tagTitle(L(), "world-cup")).toBe("world cup — upcoming dates and countdowns");
  });

  it("never put the day count in a title — it would go stale in the index", () => {
    for (const title of [eventTitle(L(), EVENT), seriesTitle(L(), SERIES), seriesHeading(L(), SERIES)]) {
      expect(title).not.toContain("107");
    }
  });

  it("say the day count in the description, where a re-crawl refreshes it", () => {
    expect(eventDescription(L(), EVENT)).toContain("107");
    expect(daysSentence(L(), 0)).toBe("That is today.");
    expect(daysSentence(L(), 1)).toBe("That is tomorrow.");
    expect(daysSentence(L(), -1)).toBe("That was yesterday.");
    expect(daysSentence(L(), -3)).toBe("That was 3 days ago.");
    expect(daysSentence(L(), null)).toBe("");
  });

  it("mark a status inline rather than in a second sentence", () => {
    expect(eventDescription(L(), { ...EVENT, status: "cancelled" })).toContain("Christmas Day (cancelled) is on");
  });

  it("say 'expected' rather than inventing a day for a coarse precision", () => {
    const coarse = { ...EVENT, date: "2027-06-01", datePrecision: "month" as const, daysUntil: undefined };
    expect(expectedPeriod(L(), coarse.date, "month")).toBe("June 2027");
    expect(expectedPeriod(L(), coarse.date, "quarter")).toBe("Q2 2027");
    expect(expectedPeriod(L(), coarse.date, "year")).toBe("2027");
    expect(eventTitle(L(), coarse)).toBe("When is Christmas Day? Expected June 2027");
    expect(eventDescription(L(), coarse)).toContain("is expected June 2027");
  });

  it("keep descriptions inside the 155-character budget", () => {
    const long = { ...EVENT, title: "A".repeat(200) };
    expect(eventDescription(L(), long).length).toBeLessThanOrEqual(155);
    expect(seriesDescription(L(), { ...SERIES, title: "A".repeat(200) }).length).toBeLessThanOrEqual(155);
  });
});

describe("buildMetadata", () => {
  const base = { title: "T", description: "D", canonical: "/days-until/christmas", ogPath: "/og/default" };

  it("canonicalises to the locale's own URL", () => {
    expect(buildMetadata({ ...base, locale: "en" }).alternates?.canonical).toContain("/days-until/christmas");
    expect(buildMetadata({ ...base, locale: "es" }).alternates?.canonical).toContain("/es/cuantos-dias-faltan/christmas");
  });

  it("declares a reciprocal hreflang cluster with an x-default", () => {
    const languages = buildMetadata({ ...base, locale: "es" }).alternates?.languages as Record<string, string>;
    expect(Object.keys(languages).sort()).toEqual([...LOCALES, "x-default"].sort());
    expect(languages["x-default"]).toBe(languages[DEFAULT_LOCALE]);
    for (const locale of LOCALES) {
      const other = buildMetadata({ ...base, locale }).alternates?.languages as Record<string, string>;
      expect(other, locale).toEqual(languages);
    }
  });

  it("declares no alternates for a page it also tells Google not to index", () => {
    const meta = buildMetadata({ ...base, locale: "es", noindex: true });
    expect(meta.alternates?.languages).toBeUndefined();
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it("narrows the cluster to the locales a page is really published in", () => {
    const meta = buildMetadata({ ...base, locale: "es", translatedIn: ["en", "es"] });
    const languages = meta.alternates?.languages as Record<string, string>;
    expect(Object.keys(languages).sort()).toEqual(["en", "es", "x-default"]);
  });

  it("drops the cluster entirely when the page exists in one language", () => {
    const meta = buildMetadata({ ...base, locale: "en", translatedIn: ["en"] });
    expect(meta.alternates?.languages).toBeUndefined();
  });

  it("stamps og:locale and the alternates Open Graph expects", () => {
    const og = buildMetadata({ ...base, locale: "pt" }).openGraph as { locale?: string; alternateLocale?: string[] };
    expect(og.locale).toBe("pt_BR");
    expect(og.alternateLocale).toContain("es_ES");
    expect(og.alternateLocale).not.toContain("pt_BR");
  });
});
