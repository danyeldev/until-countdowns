import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CollectionCalendarButtons,
  keepMenuInViewport,
} from "@/components/CollectionCalendarButtons";

const ICS_PATH = "/ics/collection/ada/autumn-nights.ics";

describe("CollectionCalendarButtons", () => {
  it("hides the menu when nothing can go on a calendar", () => {
    expect(
      renderToStaticMarkup(
        createElement(CollectionCalendarButtons, {
          title: "Autumn nights",
          icsPath: ICS_PATH,
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
        icsPath: ICS_PATH,
        eventCount: 3,
        filename: "ada-autumn-nights.ics",
      }),
    );
    expect(html).toContain("Add all to calendar");
    expect(html).toContain("Adds all 3 dated countdowns");
    expect(html).toContain(`href="${ICS_PATH}"`);
    expect(html).toContain("ada-autumn-nights.ics");
    expect(html).toContain("Copy calendar URL");
    expect(html).toContain("left-0");
    expect(html).not.toContain("right-0");
  });

  it("right-aligns from the sm breakpoint when asked, not on a phone", () => {
    const html = renderToStaticMarkup(
      createElement(CollectionCalendarButtons, {
        title: "Autumn nights",
        icsPath: ICS_PATH,
        eventCount: 3,
        filename: "ada-autumn-nights.ics",
        align: "end",
      }),
    );
    expect(html).toContain("left-0");
    expect(html).toContain("max-sm:right-auto");
    expect(html).toContain("sm:left-auto");
    expect(html).toContain("sm:right-0");
  });
});

describe("keepMenuInViewport", () => {
  it("nudges a left-overflowing menu back onto the screen", () => {
    // right-0 on a left-wrapped phone button: 288px menu ending at the button's right edge.
    expect(keepMenuInViewport(-48, 240, 390)).toBe(60);
  });

  it("nudges a right-overflowing menu back onto the screen", () => {
    expect(keepMenuInViewport(200, 500, 390)).toBe(-122);
  });

  it("leaves a menu that already fits", () => {
    expect(keepMenuInViewport(20, 300, 390)).toBe(0);
  });
});
