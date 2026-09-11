import { describe, expect, it } from "vitest";
import { LOCALES } from "@/lib/i18n/config";
import { compactDate, countryName, humanDays, list, longDate, monthYear, number, shortDate, whenDate } from "@/lib/i18n/format";
import { formatCompactDate, formatWhen, humanDays as humanDaysEn } from "@/lib/time";

describe("English output is unchanged", () => {
  // These strings are in the <title> and description of tens of thousands of indexed pages. A
  // difference here is a re-crawl of the whole corpus for no gain, so it is a test, not a habit.
  it("humanDays matches the pre-i18n implementation for every delta that can occur", () => {
    for (let d = -6000; d <= 6000; d++) expect(humanDays("en", d), String(d)).toBe(humanDaysEn(d));
    expect(humanDays("en", null)).toBe("");
    expect(humanDays("en", undefined)).toBe("");
    expect(humanDays("en", Number.NaN)).toBe("");
  });

  it("longDate keeps the hand-rolled 'Friday, 25 December 2026' shape", () => {
    expect(longDate("en", "2026-12-25")).toBe("Friday, 25 December 2026");
    // …and names the day the row is filed under, not the UTC one: a 20:00 New York premiere carries
    // the instant 2026-12-13T01:00Z and belongs to the 12th, which is what its slug says.
    expect(longDate("en", "2026-12-13T01:00:00Z", "America/New_York")).toBe("Saturday, 12 December 2026");
    expect(longDate("en", "2026-12-13T01:00:00Z")).toBe("Sunday, 13 December 2026");
    expect(longDate("en", "not-a-date", null, "a date to be announced")).toBe("a date to be announced");
  });

  it("shortDate keeps 'Mon, 14 Sep 2026' and the catalog day", () => {
    expect(shortDate("en", "2026-09-12")).toBe("Sat, 12 Sep 2026");
    expect(shortDate("en", "2026-09-15T00:00:00Z", "America/New_York")).toBe("Mon, 14 Sep 2026");
  });

  it("compactDate and whenDate match src/lib/time.ts", () => {
    expect(compactDate("en", "2026-09-12")).toBe(formatCompactDate("2026-09-12"));
    expect(compactDate("en", "2026-09-15T00:00:00Z", "America/New_York")).toBe(
      formatCompactDate("2026-09-15T00:00:00Z", "America/New_York"),
    );
    expect(whenDate("en", "2026-12-25")).toBe(formatWhen("2026-12-25"));
  });

  it("monthYear is still 'December 2026'", () => {
    expect(monthYear("en", 2026, 12)).toBe("December 2026");
  });
});

describe("other locales", () => {
  it("render the date in their own grammar", () => {
    expect(longDate("es", "2026-12-25")).toBe("viernes, 25 de diciembre de 2026");
    expect(longDate("de", "2026-12-25")).toBe("Freitag, 25. Dezember 2026");
    expect(longDate("ja", "2026-12-25")).toContain("2026年12月25日");
  });

  it("render the countdown in their own grammar", () => {
    expect(humanDays("es", 3)).toBe("dentro de 3 días");
    expect(humanDays("de", 3)).toBe("in 3 Tagen");
    expect(humanDays("tr", 3)).toBe("3 gün sonra");
    expect(humanDays("pl", 21)).toBe("za 3 tygodnie");
  });

  it("name countries from ICU, so no country list needs translating", () => {
    expect(countryName("es", "ES")).toBe("España");
    expect(countryName("ja", "FR")).toBe("フランス");
    expect(countryName("en", "DE")).toBe("Germany");
  });

  it("fall back rather than throw on a code ICU does not know", () => {
    // `fallback: "none"` is what makes this possible: ICU returns undefined for an unassigned code
    // instead of "Unknown Region", so `COUNTRY_NAMES` gets its turn.
    expect(countryName("es", "QQ", "Somewhere")).toBe("Somewhere");
    expect(countryName("es", "QQ")).toBe("QQ");
  });

  it("group numbers their own way", () => {
    expect(number("en", 1234)).toBe("1,234");
    expect(number("de", 1234)).toBe("1.234");
  });

  it("join lists their own way", () => {
    expect(list("en", ["a", "b", "c"])).toBe("a, b, and c");
    expect(list("es", ["a", "b", "c"])).toBe("a, b y c");
  });
});

describe("every locale can format everything", () => {
  it.each(LOCALES)("%s produces a non-empty string for each formatter", (locale) => {
    expect(longDate(locale, "2027-03-01")).not.toBe("");
    expect(shortDate(locale, "2027-03-01")).not.toBe("");
    expect(compactDate(locale, "2027-03-01")).not.toBe("");
    expect(whenDate(locale, "2027-03-01T18:30:00Z", false)).not.toBe("");
    expect(whenDate(locale, "2027-03-01T18:30:00Z", false, "America/New_York")).not.toBe("");
    expect(monthYear(locale, 2027, 3)).not.toBe("");
    expect(humanDays(locale, 42)).not.toBe("");
    expect(number(locale, 1234)).not.toBe("");
    expect(countryName(locale, "BR")).not.toBe("");
  });

  it.each(LOCALES)("%s degrades to a fallback on a broken date instead of throwing", (locale) => {
    expect(longDate(locale, "", null, "TBA")).toBe("TBA");
    expect(shortDate(locale, "nonsense")).toBe("TBA");
    expect(compactDate(locale, "nonsense")).toBe("—");
  });
});
