import { describe, expect, it } from "vitest";
import { collectionEventPath, collectionPhase } from "@/lib/personal-collection";
import { decodeSharePayload, userEventFromDraft } from "@/lib/user-events";

const event = userEventFromDraft({ title: "京都へ旅行 🌸", date: "2027-06-14", description: "A week away." });
const noon = new Date(2027, 5, 14, 12).getTime();

describe("personal collection lifecycle", () => {
  it("keeps an all-day countdown in the active collection throughout its local day", () => {
    expect(collectionPhase(event, noon)).toBe("upcoming");
    expect(collectionPhase(event, new Date(2027, 5, 15, 0).getTime())).toBe("past");
  });

  it("keeps a multi-day event active until its final calendar day ends", () => {
    expect(collectionPhase({ ...event, endDate: "2027-06-16" }, new Date(2027, 5, 16, 22).getTime())).toBe("upcoming");
  });

  it("compares timed dates as instants, including their UTC offsets", () => {
    const timed = { ...event, date: "2027-06-14T16:00:00+02:00", allDay: false };
    expect(collectionPhase(timed, Date.parse("2027-06-14T13:59:00Z"))).toBe("upcoming");
    expect(collectionPhase(timed, Date.parse("2027-06-14T14:01:00Z"))).toBe("past");
  });

  it.each(["postponed", "cancelled", "retired"] as const)("keeps %s dates in changed plans even after the original date passes", (status) => {
    expect(collectionPhase({ ...event, status }, new Date(2028, 0, 1).getTime())).toBe("changed");
  });

  it("does not expire an approximate year at its placeholder start date", () => {
    expect(collectionPhase({ ...event, date: "2027-01-01", datePrecision: "year", periodEnd: "2027-12-31" }, noon)).toBe("upcoming");
    expect(collectionPhase({ ...event, date: "2027-01-01", datePrecision: "year" }, noon)).toBe("upcoming");
    expect(collectionPhase({ ...event, date: "2027-01-01", datePrecision: "year", periodEnd: "2027-12-31" }, new Date(2028, 0, 1).getTime())).toBe("past");
  });

  it("keeps completed and missing records distinct", () => {
    expect(collectionPhase({ ...event, status: "done" }, noon)).toBe("past");
    expect(collectionPhase(undefined, noon)).toBe("unavailable");
  });

  it("keeps saved shared dates portable while owned dates retain their local URL", () => {
    const sharedPath = collectionEventPath(event, false);
    expect(sharedPath).toMatch(/^\/event\/share-/);
    expect(decodeSharePayload(sharedPath.slice("/event/share-".length))).toEqual(event);
    expect(collectionEventPath(event, true)).toBe(`/event/${event.slug}`);
    expect(collectionEventPath({ ...event, source: "curated", slug: "public-date-2027-06-14" }, false)).toBe("/event/public-date-2027-06-14");
  });
});
