import { describe, expect, it } from "vitest";
import { catalogDay, formatCompactDate } from "@/lib/time";
import { shortDate } from "@/lib/i18n/format";

/**
 * The day a row is filed under. Ingest uses it for the slug and the SQL trigger derives `starts_on`
 * the same way, so these cases are the contract between the two — see supabase/migrations/0011.
 */
describe("catalogDay", () => {
  it("leaves an all-day date alone", () => {
    expect(catalogDay("2026-09-12")).toBe("2026-09-12");
    expect(catalogDay("2026-09-12", "America/New_York")).toBe("2026-09-12");
  });

  it("uses the event's own zone for an instant", () => {
    // 20:00 in New York on the 14th is 00:00Z on the 15th: the event happens on the 14th.
    expect(catalogDay("2026-09-15T00:00:00Z", "America/New_York")).toBe("2026-09-14");
    // 23:30 in Tokyo on the 28th is 14:30Z the same day.
    expect(catalogDay("2026-09-28T14:30:00Z", "Asia/Tokyo")).toBe("2026-09-28");
    // And the other direction: 09:00 in Tokyo on the 29th is 00:00Z on the 29th.
    expect(catalogDay("2026-09-29T00:00:00Z", "Asia/Tokyo")).toBe("2026-09-29");
  });

  it("falls back to the UTC day when there is nothing better", () => {
    expect(catalogDay("2026-09-15T00:00:00Z")).toBe("2026-09-15");
    expect(catalogDay("2026-09-15T00:00:00Z", null)).toBe("2026-09-15");
  });

  it("never throws on input it cannot use", () => {
    // An unrecognised zone must not fail an ingest pass or a render.
    expect(catalogDay("2026-09-15T00:00:00Z", "Mars/Olympus_Mons")).toBe("2026-09-15");
    expect(catalogDay("not-a-date-at-allT", "America/New_York")).toBe("not-a-date");
  });

  it("holds across a DST boundary", () => {
    // 01:30Z on 2 November 2026 is 21:30 on the 1st in New York, an hour after the clocks go back.
    expect(catalogDay("2026-11-02T01:30:00Z", "America/New_York")).toBe("2026-11-01");
  });
});

describe("the listings agree with it", () => {
  it("names the event's day, not the viewer's and not UTC's", () => {
    // Both of these render on the server and in the browser, so they must not depend on either
    // clock: a premiere at 20:00 in New York reads as the 14th wherever it is read.
    expect(formatCompactDate("2026-09-15T00:00:00Z", "America/New_York")).toBe("Sep 14, 2026");
    expect(shortDate("en", "2026-09-15T00:00:00Z", "America/New_York")).toBe("Mon, 14 Sep 2026");
  });

  it("still renders an all-day date in UTC", () => {
    expect(formatCompactDate("2026-09-12")).toBe("Sep 12, 2026");
    expect(shortDate("en", "2026-09-12")).toBe("Sat, 12 Sep 2026");
  });
});
