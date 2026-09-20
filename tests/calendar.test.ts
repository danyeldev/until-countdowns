import { describe, expect, it, vi } from "vitest";
import {
  calendarDescription,
  calendarEvents,
  calendarFileSlug,
  calendarLocation,
  googleCalendarFeedUrl,
  googleCalendarUrl,
  hostedCalendarUrl,
  icsContent,
  icsFeedContent,
  outlookCalendarFeedUrl,
  outlookCalendarUrl,
  sanitizeCalendarEvent,
} from "@/lib/calendar";
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

  it("does not add the catalog source URL", () => {
    const sourced = { ...EVENT, sourceUrl: "https://en.wikipedia.org/wiki/2026_Asian_Games" };
    expect(calendarDescription(sourced)).not.toContain("Source:");
    expect(calendarDescription(sourced)).not.toContain(sourced.sourceUrl);
  });

  it("uses the event description, not a Wikidata source stub", () => {
    const summary =
      "Grand Theft Auto VI is an upcoming action-adventure game developed and published by Rockstar Games.";
    const body = calendarDescription({
      ...EVENT,
      title: "Grand Theft Auto VI",
      description: "Scheduled event from Wikidata.",
      summary,
      sourceUrl: "https://www.wikidata.org/wiki/Q109344778",
    });
    expect(body.startsWith(summary)).toBe(true);
    expect(body).toContain(`Countdown: https://`);
    expect(body).not.toContain("Wikidata");
    expect(body).not.toContain("Source:");
  });

  it("keeps a real description and drops the Wikipedia/Wikidata credit sentence", () => {
    const body = calendarDescription({
      ...EVENT,
      description:
        "UFC 331 is scheduled to start on 19 September 2026 in the United States. Listed among scheduled sports events on Wikipedia; dates come from Wikidata and may change.",
    });
    expect(body).toContain("UFC 331 is scheduled to start on 19 September 2026 in the United States.");
    expect(body).not.toContain("Wikipedia");
    expect(body).not.toContain("Wikidata");
  });

  it("rewrites a Vercel preview host onto the public origin", () => {
    const preview = "https://until-countdowns-git-fix-acme.vercel.app/event/share-abc123";
    const body = calendarDescription(EVENT, preview);
    expect(body).toContain("Countdown: https://until.day/event/share-abc123");
    expect(body).not.toContain("vercel.app");
    expect(line(icsContent(EVENT, preview), "URL")).toBe("https://until.day/event/share-abc123");
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

/** The whole logical line for a property, parameters included (`DTEND;VALUE=DATE:20260920`). */
function findProp(ics: string, name: string): string | undefined {
  return unfold(ics)
    .split("\r\n")
    .find((l) => l.startsWith(`${name}:`) || l.startsWith(`${name};`));
}

function prop(ics: string, name: string): string {
  const found = findProp(ics, name);
  if (!found) throw new Error(`no ${name} line`);
  return found;
}

function has(ics: string, name: string): boolean {
  return findProp(ics, name) !== undefined;
}

/** A festival row as musicbrainz stores it: venue, city, ISO-3166 alpha-2 country, coordinates. */
const VENUE_EVENT: CountdownEvent = {
  ...EVENT,
  location: { name: "Tokyo Dome", city: "Tokyo", country: "JP", lat: 35.705601, lng: 139.751999 },
};

describe("calendarLocation", () => {
  it("reads venue, city, country — narrowest first", () => {
    expect(calendarLocation(VENUE_EVENT)).toBe("Tokyo Dome, Tokyo, Japan");
  });

  it("expands an ISO code and passes an already-named country through", () => {
    // musicbrainz/espn/confs store `JP`; liquipedia stores `United States`. Both have to read well.
    expect(calendarLocation({ ...EVENT, location: { city: "Austin", country: "US" } })).toBe(
      "Austin, United States of America",
    );
    expect(calendarLocation({ ...EVENT, location: { city: "Austin", country: "United States" } })).toBe(
      "Austin, United States",
    );
  });

  it("never emits a bare country, and never an empty string", () => {
    expect(calendarLocation({ ...EVENT, location: { country: "JP" } })).toBe("");
    expect(calendarLocation({ ...EVENT, location: {} })).toBe("");
    expect(calendarLocation(EVENT)).toBe("");
  });

  it("says a name once", () => {
    // A city-state, and a venue named after its town: "Singapore, Singapore" reads like a typo.
    expect(calendarLocation({ ...EVENT, location: { city: "Singapore", country: "SG" } })).toBe("Singapore");
    expect(calendarLocation({ ...EVENT, location: { name: "Roskilde", city: "roskilde" } })).toBe("Roskilde");
  });
});

describe("LOCATION in the calendar entry", () => {
  it("emits the place as a TEXT value in the ICS", () => {
    expect(line(icsContent(VENUE_EVENT), "LOCATION")).toBe("Tokyo Dome\\, Tokyo\\, Japan");
  });

  it("escapes LOCATION exactly as it escapes DESCRIPTION", () => {
    // LOCATION is TEXT (RFC 5545 §3.8.1.7): an unescaped comma or semicolon in a venue name splits
    // the value, and a lone backslash escapes whatever follows it.
    const ics = icsContent({
      ...VENUE_EVENT,
      location: { name: "Hall A; Stage B, back\\lot", city: "Tokyo", country: "JP" },
    });
    expect(line(ics, "LOCATION")).toBe("Hall A\\; Stage B\\, back\\\\lot\\, Tokyo\\, Japan");
  });

  it("folds a long LOCATION to 75 octets, reversibly", () => {
    const ics = icsContent({
      ...VENUE_EVENT,
      location: { name: "Nagoya City General Gymnasium (Nippon Gaishi Hall) — main arena", city: "名古屋", country: "JP" },
    });
    const encoder = new TextEncoder();
    for (const l of ics.split("\r\n")) {
      expect(encoder.encode(l).length).toBeLessThanOrEqual(75);
      expect(l).not.toContain("\uFFFD");
    }
    expect(line(ics, "LOCATION")).toContain("Nippon Gaishi Hall");
    expect(line(ics, "LOCATION")).toContain("名古屋");
  });

  it("omits the line entirely when the row has no usable place", () => {
    expect(has(icsContent(EVENT), "LOCATION")).toBe(false);
    expect(has(icsContent({ ...EVENT, location: { country: "JP" } }), "LOCATION")).toBe(false);
  });

  it("passes the place to Google and to Outlook", () => {
    expect(new URL(googleCalendarUrl(VENUE_EVENT)).searchParams.get("location")).toBe("Tokyo Dome, Tokyo, Japan");
    expect(new URL(outlookCalendarUrl(VENUE_EVENT)).searchParams.get("location")).toBe("Tokyo Dome, Tokyo, Japan");
  });

  it("sends no location parameter at all when there is nothing to send", () => {
    expect(new URL(googleCalendarUrl(EVENT)).searchParams.has("location")).toBe(false);
    expect(new URL(outlookCalendarUrl(EVENT)).searchParams.has("location")).toBe(false);
  });
});

describe("GEO", () => {
  it("emits the coordinates as an unescaped FLOAT pair", () => {
    // The semicolon is the value separator here, not a TEXT delimiter: escaping it would break it.
    expect(line(icsContent(VENUE_EVENT), "GEO")).toBe("35.705601;139.751999");
  });

  it("keeps a pin off the map rather than putting it in the wrong place", () => {
    const geo = (location: CountdownEvent["location"]) => has(icsContent({ ...EVENT, location }), "GEO");
    expect(geo({ name: "Tokyo Dome" })).toBe(false);
    expect(geo({ name: "Null Island", lat: 0, lng: 0 })).toBe(false);
    expect(geo({ name: "Off the globe", lat: 91, lng: 0 })).toBe(false);
    expect(geo({ name: "Off the globe", lat: 0, lng: 181 })).toBe(false);
    expect(geo({ name: "Fine", lat: 55.6761, lng: 12.5683 })).toBe(true);
  });
});

/**
 * RFC 5545 §3.8.2.2: DTEND must carry the same value type as DTSTART and must be later than it.
 * None of these rows can be built by an adapter today, but every one of them is a value the
 * `CountdownEvent` type permits, and a builder should not emit a file a client rejects for any of
 * them. The first is the shape a tour arrives in: an instant start, a day-granularity last day.
 */
describe("DTSTART and DTEND agree on their value type", () => {
  const TIMED_DAY_END: CountdownEvent = {
    ...EVENT,
    allDay: false,
    date: "2027-07-09T19:00:00Z",
    endDate: "2027-07-10",
  };

  it("promotes a date-only end to the instant that ends that day", () => {
    const ics = icsContent(TIMED_DAY_END);
    expect(prop(ics, "DTSTART")).toBe("DTSTART:20270709T190000Z");
    // Exclusive, like the all-day end: midnight opening the 11th is the end of the 10th.
    expect(prop(ics, "DTEND")).toBe("DTEND:20270711T000000Z");
  });

  it("does not cut the last day off the Google and Outlook links", () => {
    expect(new URL(googleCalendarUrl(TIMED_DAY_END)).searchParams.get("dates")).toBe(
      "20270709T190000Z/20270711T000000Z",
    );
    expect(new URL(outlookCalendarUrl(TIMED_DAY_END)).searchParams.get("enddt")).toBe("2027-07-11T00:00:00.000Z");
  });

  it("keeps a whole-day pair whole when the row is flagged timed but carries no time", () => {
    // `buildEvent()` keeps a caller's `allDay: false` next to a `YYYY-MM-DD` date, and a DATE-TIME
    // DTSTART built from that would be malformed and would invent a midnight nobody claimed.
    const ics = icsContent({ ...EVENT, allDay: false, date: "2038-01-19", endDate: "2038-01-20" });
    expect(prop(ics, "DTSTART")).toBe("DTSTART;VALUE=DATE:20380119");
    expect(prop(ics, "DTEND")).toBe("DTEND;VALUE=DATE:20380121");
    expect(new URL(googleCalendarUrl({ ...EVENT, allDay: false, date: "2038-01-19" })).searchParams.get("dates")).toBe(
      "20380119/20380120",
    );
  });

  it("builds both Outlook all-day bounds from the day part", () => {
    // Concatenating `T00:00:00` / `T23:59:59` onto a bound that already carries a time yields
    // `2026-09-21T23:00:00ZT23:59:59`, which is not a datetime at all.
    const url = new URL(outlookCalendarUrl({ ...EVENT, endDate: "2026-09-21T23:00:00Z" }));
    expect(url.searchParams.get("enddt")).toBe("2026-09-21T23:59:59");
    const timedStart = new URL(outlookCalendarUrl({ ...EVENT, date: "2026-09-19T10:00:00Z" }));
    expect(timedStart.searchParams.get("startdt")).toBe("2026-09-19T00:00:00");
  });

  it("refuses to emit an end before its start", () => {
    // Backwards dates are impossible in the database (`events_end_after_start`) but not in a
    // personal countdown or a share payload, and a client can reject the whole file over them.
    const timed = icsContent({ ...EVENT, allDay: false, date: "2027-07-09T19:00:00Z", endDate: "2027-07-01" });
    expect(prop(timed, "DTEND")).toBe("DTEND:20270709T200000Z");
    const allDay = icsContent({ ...EVENT, endDate: "2026-09-01" });
    expect(prop(allDay, "DTEND")).toBe("DTEND;VALUE=DATE:20260920");
  });

  it("still gives a timed row without an end one hour", () => {
    const ics = icsContent({ ...EVENT, allDay: false, date: "2027-07-09T19:00:00Z" });
    expect(prop(ics, "DTSTART")).toBe("DTSTART:20270709T190000Z");
    expect(prop(ics, "DTEND")).toBe("DTEND:20270709T200000Z");
  });

  it("holds for every shape the type permits", () => {
    const shapes: CountdownEvent[] = [
      EVENT,
      { ...EVENT, endDate: "2026-09-22" },
      { ...EVENT, endDate: "2026-09-22T18:00:00Z" },
      { ...EVENT, allDay: false, date: "2026-09-19T10:00:00Z" },
      { ...EVENT, allDay: false, date: "2026-09-19T10:00:00Z", endDate: "2026-09-22" },
      { ...EVENT, allDay: false, date: "2026-09-19T10:00:00Z", endDate: "2026-09-22T18:00:00Z" },
      { ...EVENT, allDay: false, date: "2026-09-19" },
      { ...EVENT, allDay: false, date: "2026-09-19", endDate: "2026-09-22" },
      { ...EVENT, endDate: "nonsense" },
      { ...EVENT, allDay: false, date: "2026-09-19T10:00:00Z", endDate: "nonsense" },
    ];
    for (const shape of shapes) {
      const ics = icsContent(shape);
      const start = prop(ics, "DTSTART");
      const end = prop(ics, "DTEND");
      const dated = start.startsWith("DTSTART;VALUE=DATE:");
      expect(end.startsWith("DTEND;VALUE=DATE:")).toBe(dated);
      const value = (l: string) => l.slice(l.indexOf(":") + 1);
      expect(value(start)).toMatch(dated ? /^\d{8}$/ : /^\d{8}T\d{6}Z$/);
      expect(value(end)).toMatch(dated ? /^\d{8}$/ : /^\d{8}T\d{6}Z$/);
      expect(value(end) > value(start)).toBe(true);
    }
  });
});

const OTHER: CountdownEvent = {
  ...EVENT,
  id: "halloween-2026-10-31",
  slug: "halloween-2026-10-31",
  title: "Halloween",
  description: "Candy.",
  date: "2026-10-31",
};

describe("icsFeedContent", () => {
  it("writes one VEVENT per dated countdown", () => {
    const ics = unfold(icsFeedContent([EVENT, OTHER], { name: "Autumn nights" }));
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("UID:asian-games-2026-09-19@until");
    expect(ics).toContain("UID:halloween-2026-10-31@until");
    expect(ics).toContain("X-WR-CALNAME:Autumn nights");
    expect(ics).toContain("NAME:Autumn nights");
  });

  it("drops rows a calendar must not invent a day for", () => {
    const ics = unfold(
      icsFeedContent([
        EVENT,
        { ...OTHER, datePrecision: "year" },
        { ...OTHER, id: "cancelled", status: "cancelled" },
      ]),
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain("UID:asian-games-2026-09-19@until");
    expect(ics).not.toContain("Halloween");
  });

  it("stays an empty calendar when nothing is dated", () => {
    expect(icsFeedContent([{ ...EVENT, datePrecision: "month" }])).toBe(
      "BEGIN:VCALENDAR\r\nEND:VCALENDAR",
    );
    expect(calendarEvents([{ ...EVENT, datePrecision: "month" }, OTHER])).toEqual([OTHER]);
  });

  it("omits a calendar name when the caller did not give one", () => {
    const ics = unfold(icsFeedContent([EVENT]));
    expect(ics).not.toContain("X-WR-CALNAME");
    expect(ics).not.toContain("\nNAME:");
    expect(ics).toContain("UID:asian-games-2026-09-19@until");
  });

  it("uses the caller's page URL for each row", () => {
    const ics = icsFeedContent([EVENT], {
      eventUrl: () => "https://until.test/event/share-abc123",
    });
    expect(line(ics, "URL")).toBe("https://until.test/event/share-abc123");
  });

  it("escapes a collection name the same way it escapes SUMMARY", () => {
    expect(line(icsFeedContent([EVENT], { name: "Hall A; Stage B, back\\lot" }), "X-WR-CALNAME")).toBe(
      "Hall A\\; Stage B\\, back\\\\lot",
    );
  });
});

describe("sanitizeCalendarEvent", () => {
  it("collapses a title to one line and keeps paragraph breaks in the description", () => {
    const clean = sanitizeCalendarEvent({
      ...EVENT,
      title: "Asian\nGames",
      description: "One.\n\n\nTwo.",
      summary: "A\r\nsummary",
    });
    expect(clean.title).toBe("Asian Games");
    expect(clean.description).toBe("One.\n\nTwo.");
    expect(clean.summary).toBe("A\nsummary");
  });
});

describe("collection calendar subscribe links", () => {
  const feed = "https://until.day/ics/collection/ada/autumn-nights.ics";

  it("hands Google the feed as webcal cid on the mobile calendar screen", () => {
    const url = new URL(googleCalendarFeedUrl(feed));
    expect(url.pathname).toBe("/calendar/r");
    // https in cid is rejected ("Unable to add calendar. Check the URL"); webcal is not.
    expect(url.searchParams.get("cid")).toBe(
      "webcal://until.day/ics/collection/ada/autumn-nights.ics",
    );
  });

  it("hands Outlook the feed and the collection title", () => {
    const url = new URL(outlookCalendarFeedUrl(feed, "Autumn nights"));
    expect(url.searchParams.get("url")).toBe(feed);
    expect(url.searchParams.get("name")).toBe("Autumn nights");
  });

  it("refuses an empty or relative feed URL", () => {
    expect(googleCalendarFeedUrl("")).toBe("#");
    expect(googleCalendarFeedUrl("/ics/collection/ada/autumn-nights.ics")).toBe("#");
    expect(outlookCalendarFeedUrl("", "Autumn nights")).toBe("#");
  });

  it("keeps a subscribe URL on the host the reader is on", () => {
    expect(hostedCalendarUrl("/ics/featured/scream-this-month.ics")).toBe(
      "https://until.day/ics/featured/scream-this-month.ics",
    );
  });

  it("strips a trailing .ics so the file URL and the slug share a parser", () => {
    expect(calendarFileSlug("scream-this-month.ics")).toBe("scream-this-month");
    expect(calendarFileSlug("scream-this-month")).toBe("scream-this-month");
  });

  it("does not rewrite a preview origin onto until.day", () => {
    vi.stubGlobal("window", {
      location: { origin: "https://until-git-preview.vercel.app" },
    });
    expect(hostedCalendarUrl("/ics/featured/scream-this-month.ics")).toBe(
      "https://until-git-preview.vercel.app/ics/featured/scream-this-month.ics",
    );
    vi.unstubAllGlobals();
  });
});
