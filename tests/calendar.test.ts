import { describe, expect, it } from "vitest";
import { calendarDescription, googleCalendarUrl, icsContent, outlookCalendarUrl } from "@/lib/calendar";
import type { CountdownEvent } from "@/lib/types";

const EVENT: CountdownEvent = {
  id: "asian-games-2026-09-19",
  slug: "asian-games-2026-09-19",
  title: "Asian Games",
  description: "The 20th Asian Games in Aichi Prefecture and Nagoya, Japan.",
  date: "2026-09-19",
  allDay: true,
  category: "sports",
  tags: ["sport"],
  regions: ["JP"],
  source: "curated",
  featured: false,
  popularity: 50,
};

/** Reverse RFC 5545 line folding, so an assertion can look at the logical content line. */
function unfold(ics: string): string {
  return ics.replace(/\r\n /g, "");
}

function line(ics: string, name: string): string {
  const found = unfold(ics)
    .split("\r\n")
    .find((l) => l.startsWith(`${name}:`));
  if (!found) throw new Error(`no ${name} line`);
  return found.slice(name.length + 1);
}

describe("calendarDescription", () => {
  it("carries the way back to the countdown", () => {
    const body = calendarDescription(EVENT);
    expect(body).toContain(EVENT.description);
    expect(body).toContain("Countdown: https://");
    expect(body).toContain(`/event/${EVENT.slug}`);
  });

  it("names the source when the catalog has one", () => {
    const sourced = { ...EVENT, sourceUrl: "https://en.wikipedia.org/wiki/2026_Asian_Games" };
    expect(calendarDescription(sourced)).toContain("Source: https://en.wikipedia.org/wiki/2026_Asian_Games");
    expect(calendarDescription(EVENT)).not.toContain("Source:");
  });

  it("takes the caller's page URL over the event's own", () => {
    // A shared personal countdown lives at its payload URL; the `mine-…` slug resolves nowhere else.
    const body = calendarDescription(EVENT, "https://until.test/event/share-abc123");
    expect(body).toContain("Countdown: https://until.test/event/share-abc123");
    expect(body).not.toContain(`/event/${EVENT.slug}`);
  });

  it("falls back to the title when there is no description", () => {
    expect(calendarDescription({ ...EVENT, description: "" })).toContain(EVENT.title);
  });
});

describe("the hosted calendar links", () => {
  it("puts the link in the Google details", () => {
    const details = new URL(googleCalendarUrl(EVENT)).searchParams.get("details") ?? "";
    expect(details).toContain(`/event/${EVENT.slug}`);
    expect(details).toContain(EVENT.description);
  });

  it("puts the link in the Outlook body", () => {
    const body = new URL(outlookCalendarUrl(EVENT)).searchParams.get("body") ?? "";
    expect(body).toContain(`/event/${EVENT.slug}`);
  });

  it("still refuses a date it cannot read", () => {
    expect(googleCalendarUrl({ ...EVENT, date: "not-a-date" })).toBe("#");
    expect(outlookCalendarUrl({ ...EVENT, date: "not-a-date" })).toBe("#");
    expect(icsContent({ ...EVENT, date: "not-a-date" })).toBe("BEGIN:VCALENDAR\r\nEND:VCALENDAR");
  });
});

describe("icsContent", () => {
  it("repeats the page in URL, unescaped", () => {
    // `URL` is a URI value, not TEXT: escaping its commas would corrupt the address.
    const ics = icsContent(EVENT, "https://until.test/event/a,b;c");
    expect(line(ics, "URL")).toBe("https://until.test/event/a,b;c");
  });

  it("escapes the description as TEXT", () => {
    const ics = icsContent(EVENT);
    const description = line(ics, "DESCRIPTION");
    expect(description).toContain("Nagoya\\, Japan.");
  });

  it("writes a real newline escape, not a literal backslash-n", () => {
    // The description is multi-line now, so a double-escaped `\\n` would show up verbatim in
    // every calendar client instead of breaking the line.
    const description = line(icsContent(EVENT), "DESCRIPTION");
    expect(description).toContain("\\n");
    expect(description).not.toContain("\\\\n");
  });

  it("escapes a backslash the description actually contains", () => {
    const ics = icsContent({ ...EVENT, description: "a\\b" });
    expect(line(ics, "DESCRIPTION")).toContain("a\\\\b");
  });

  it("folds every line to 75 octets", () => {
    const ics = icsContent(EVENT);
    const encoder = new TextEncoder();
    for (const l of ics.split("\r\n")) {
      expect(encoder.encode(l).length).toBeLessThanOrEqual(75);
    }
    // Folding is reversible: unfolding gets the logical line back in one piece.
    expect(unfold(ics)).toContain("The 20th Asian Games in Aichi Prefecture and Nagoya");
  });

  it("never folds through the middle of a multi-byte character", () => {
    const ics = icsContent({ ...EVENT, description: "日本".repeat(60), title: "アジア競技大会" });
    for (const l of ics.split("\r\n")) {
      expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
      expect(l).not.toContain("�");
    }
    expect(unfold(ics)).toContain("日本".repeat(60));
  });

  it("keeps the dates it always kept", () => {
    const ics = unfold(icsContent(EVENT));
    expect(ics).toContain("DTSTART;VALUE=DATE:20260919");
    // An all-day DTEND is exclusive: the day after the last one.
    expect(ics).toContain("DTEND;VALUE=DATE:20260920");
  });
});
