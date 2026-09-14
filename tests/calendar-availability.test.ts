import { describe, expect, it } from "vitest";
import {
  canAddToCalendar,
  googleCalendarUrl,
  outlookCalendarUrl,
  icsContent,
} from "../src/lib/calendar";
import { userEventFromDraft } from "../src/lib/user-events";
import type { DatePrecision, EventStatus } from "../src/lib/types";
const event = userEventFromDraft({
  title: "Future launch",
  date: "2027-01-01",
});
describe("honest calendar exports", () => {
  it.each<DatePrecision>(["month", "quarter", "year", "decade"])(
    "does not export a placeholder %s as an exact date",
    (datePrecision) => {
      const approximate = { ...event, datePrecision };
      expect(canAddToCalendar(approximate)).toBe(false);
      expect(googleCalendarUrl(approximate)).toBe("#");
      expect(outlookCalendarUrl(approximate)).toBe("#");
      expect(icsContent(approximate)).not.toContain("VEVENT");
    },
  );
  it.each<EventStatus>(["cancelled", "postponed", "retired"])(
    "does not create a new calendar entry for %s events",
    (status) => {
      expect(canAddToCalendar({ ...event, status })).toBe(false);
    },
  );
  it("still exports a real day", () => {
    expect(canAddToCalendar(event)).toBe(true);
    expect(icsContent(event)).toContain("DTSTART;VALUE=DATE:20270101");
  });
});
