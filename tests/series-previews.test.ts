import { describe, expect, it } from "vitest";
import { groupFutureOccurrences } from "../src/lib/series-previews";
import { userEventFromDraft } from "../src/lib/user-events";
import type { CountdownEvent } from "../src/lib/types";

function occurrence(
  year: number,
  extra: Partial<CountdownEvent> = {},
): CountdownEvent {
  return {
    ...userEventFromDraft({ title: "Halloween", date: `${year}-10-31` }),
    id: `halloween-${year}`,
    slug: `halloween-${year}-10-31`,
    seriesSlug: "halloween",
    regions: ["GLOBAL"],
    ...extra,
  };
}

describe("expandable future dates", () => {
  it("keeps four later occurrences in date order and leaves input untouched", () => {
    const current = occurrence(2026);
    const candidates = [2031, 2026, 2028, 2027, 2030, 2029].map((year) =>
      occurrence(year),
    );
    const before = candidates.map((row) => row.date);
    expect(
      groupFutureOccurrences([current], candidates)[current.id].map(
        (row) => row.date,
      ),
    ).toEqual(["2027-10-31", "2028-10-31", "2029-10-31", "2030-10-31"]);
    expect(candidates.map((row) => row.date)).toEqual(before);
  });
  it("preserves regional scope regardless of region ordering", () => {
    const current = occurrence(2026, { regions: ["US", "CA"] });
    expect(
      groupFutureOccurrences(
        [current],
        [
          occurrence(2027, { regions: ["CA", "US"] }),
          occurrence(2028, { regions: ["US"] }),
          occurrence(2029, { seriesSlug: "christmas", regions: ["CA", "US"] }),
        ],
      )[current.id].map((row) => row.date),
    ).toEqual(["2027-10-31"]);
  });
  it("does not repeat a date, include closed entries or count from a previous search year", () => {
    const current = occurrence(2030);
    const result = groupFutureOccurrences(
      [current],
      [
        occurrence(2027),
        occurrence(2031),
        occurrence(2031, { slug: "another-name" }),
        occurrence(2032, { status: "cancelled" }),
        occurrence(2033, { datePrecision: "year" }),
      ],
    );
    expect(result[current.id].map((row) => row.date)).toEqual([
      "2031-10-31",
      "2033-10-31",
    ]);
    expect(result[current.id][1].datePrecision).toBe("year");
  });
  it("does not query or show a recurrence for standalone events", () => {
    expect(
      groupFutureOccurrences(
        [occurrence(2026, { seriesSlug: undefined })],
        [occurrence(2027)],
      ),
    ).toEqual({});
  });
});
