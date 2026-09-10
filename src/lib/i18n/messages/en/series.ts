/**
 * The evergreen countdown pages: `/days-until`, and the per-series page under it.
 *
 * These carry the site's highest-volume queries, and the phrasing that matters most — the `<h1>`,
 * the title and the description — is not here but in `seo.series.*`, so that one locale's wording
 * of "how many days until X" is decided in one place for the heading, the tab and the snippet
 * alike. What is left here is the page around that question: the dates table, the sections under
 * it, and the words the list of series needs.
 */
import type { PluralForms } from "../types";

export const series = {
  /** `/days-until` — every recurring date, grouped by category. */
  index: {
    title: "Days until — every recurring countdown",
    description:
      "Christmas, Ramadan, the Super Bowl, the Perseids: every recurring date in the catalog with the next occurrence on top and a table of the years to come.",
    /** The `<h1>`. Left open on purpose: the page is the list of everything that could finish it. */
    heading: "How many days until…",
    intro: {
      one: "{n} date that comes back every year. Each page keeps the next occurrence on top and lists the years to come.",
      other:
        "{n} dates that come back every year. Each page keeps the next occurrence on top and lists the years to come.",
    } as PluralForms,
    empty: "The catalog is being filled — check back soon.",
    /** CollectionPage description; its name is `title` above. */
    jsonLdDescription: "Recurring dates with the next occurrence and a multi-year table.",
  },

  /** Stands in for the countdown when nothing future is linked to the series yet. */
  noUpcoming: "No upcoming date for {title} is in the catalog yet.",

  /** Link to the dated occurrence page of the next date. */
  thisYearsPage: "This year's page",

  /** Title of the share sheet — read above the URL, in the reader's own share UI. */
  shareTitle: "Days until {title}",

  /** The table of every occurrence from today on. */
  upcoming: {
    heading: "Upcoming dates",
    note: "Every {title} in the catalog from today on, soonest first.",
    empty: "No future dates yet — check back after the next refresh.",
  },

  /** The same observance on a different day somewhere: kept out of the main table. */
  variants: {
    heading: "Other dates linked to this series",
    note: "Observed under the same name on a different day in a few countries — listed apart so the countdown above stays on the main date.",
  },

  /** Heading over the curated Q&A. The questions themselves are English-only; see the page. */
  faqHeading: "Questions people ask",

  /** Label; the tag chips follow it on the same line. */
  tagsLabel: "Tags:",

  related: {
    /** `{category}` is the category name, lower-cased where `seo.hub.lowercaseCategory` says so. */
    heading: "More {category} that come back every year",
    all: "All recurring countdowns",
  },
};
