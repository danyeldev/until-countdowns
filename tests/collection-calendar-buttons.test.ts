import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CollectionCalendarButtons } from "@/components/CollectionCalendarButtons";

const ICS = "https://until.day/api/ics/collection/ada/autumn-nights";

describe("CollectionCalendarButtons", () => {
  it("hides the menu when nothing can go on a calendar", () => {
    expect(
      renderToStaticMarkup(
        createElement(CollectionCalendarButtons, {
          title: "Autumn nights",
          icsUrl: ICS,
          eventCount: 0,
          filename: "ada-autumn-nights.ics",
        }),
      ),
    ).toBe("");
  });

  it("offers Google, Outlook and a snapshot file for every dated countdown", () => {
    const html = renderToStaticMarkup(
      createElement(CollectionCalendarButtons, {
        title: "Autumn nights",
        icsUrl: ICS,
        eventCount: 3,
        filename: "ada-autumn-nights.ics",
      }),
    );
    expect(html).toContain("Add all to calendar");
    expect(html).toContain("Adds all 3 dated countdowns");
    expect(html).toContain(encodeURIComponent(ICS));
    expect(html).toContain("calendar.google.com/calendar/render");
    expect(html).toContain("outlook.live.com/calendar/0/addfromweb");
    expect(html).toContain(`href="${ICS}"`);
    expect(html).toContain("ada-autumn-nights.ics");
  });
});
