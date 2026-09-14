import { describe, expect, it } from "vitest";
import { formatRange, formatWhen, isValidDate } from "../src/lib/time";

describe("date validation and display", () => {
  it("rejects calendar rollover instead of changing the user's date", () => {
    for (const invalid of [
      "2026-02-29",
      "2026-04-31",
      "2026-02-30T12:00:00Z",
      "2026-13-01",
      "2026-00-10",
      "2026-1-1",
      "",
      "2026",
    ])
      expect(isValidDate(invalid), invalid).toBe(false);
    for (const valid of [
      "2028-02-29",
      "2026-12-31",
      "2026-09-15T00:00:00Z",
      "2026-09-15T00:00:00-03:00",
    ])
      expect(isValidDate(valid), valid).toBe(true);
  });
  it("shows an instant in its event time zone, including the local calendar day", () => {
    const formatted = formatWhen(
      "2026-09-15T00:00:00Z",
      false,
      "America/New_York",
    );
    expect(formatted).toContain("September 14, 2026");
    expect(formatted).toContain("08:00 PM");
  });
  it("uses deterministic UTC for instants without a known zone", () => {
    expect(formatWhen("2026-09-15T00:00:00Z", false)).toContain("UTC");
    expect(
      formatRange("2026-09-15T00:00:00Z", undefined, "America/New_York"),
    ).toContain("September 14");
  });
  it("keeps all-day dates independent of the event zone", () => {
    expect(formatWhen("2026-09-15", true, "America/Los_Angeles")).toContain(
      "September 15",
    );
  });
});
