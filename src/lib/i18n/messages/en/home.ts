/**
 * The home page: the hub sections at the top, the catalog explorer under them, and the strings the
 * shared listing components need — the card, the dated table, the filter pills and the pager, which
 * the hubs render too.
 *
 * The count line is written as one whole sentence per shape rather than a stem with fragments
 * appended: "1.234 fechas próximas que coinciden con “x”" puts its pieces in a different order than
 * English does, and only a full sentence lets a translator move them.
 */
import type { PluralForms } from "../types";

export const home = {
  /** `aria-label` on the skeleton shown while the first catalog read is in flight. */
  loading: "Loading the catalog",

  hero: {
    eyebrow: "Featured countdown",
    /** The category and the date, on one line under the title. */
    meta: "{category} · {when}",
    open: "Open this countdown",
  },

  /** Section headings, each with the link that closes its heading row. */
  hub: {
    alsoOnTheHorizon: "Also on the horizon",
    next7Days: "Next 7 days",
    wholeMonth: "Whole month →",
    browseByCategory: "Browse by category",
    allCategories: "All categories →",
    popularCountdowns: "Popular countdowns",
    everyRecurringDate: "Every recurring date →",
    byCountry: "By country",
    allCountries: "All countries →",
    noCountries: "Country data is being filled.",
    byMonth: "By month",
    thisMonth: "This month — {month}",
    nextMonth: "Next month — {month}",
  },

  explorer: {
    heading: "The catalog",
    count: { one: "{n} upcoming date.", other: "{n} upcoming dates." } as PluralForms,
    countMatching: {
      one: "{n} upcoming date matching “{q}”.",
      other: "{n} upcoming dates matching “{q}”.",
    } as PluralForms,
    countInCategory: {
      one: "{n} upcoming date in {category}.",
      other: "{n} upcoming dates in {category}.",
    } as PluralForms,
    countMatchingInCategory: {
      one: "{n} upcoming date matching “{q}” in {category}.",
      other: "{n} upcoming dates matching “{q}” in {category}.",
    } as PluralForms,
    sort: {
      soonest: "Soonest",
      popular: "Popular",
      latest: "Furthest",
    },
  },

  /** The leading pill of the category bar, which clears the filter. */
  filters: {
    all: "All",
  },

  /** A search that found nothing: what happened, why it might have, and where to go instead. */
  empty: {
    noMatch: "Nothing in the catalog matches “{q}”.",
    nothing: "Nothing here yet.",
    hint: "Spelling is forgiven and initials work, so a near miss should still land — this one looks like a date the catalog does not carry.",
    busiest: "Busiest categories",
    everyRecurringDate: "Every recurring date",
    startOver: "Start over",
  },

  /** Column headings of the dated table, and what it says with nothing to list. */
  table: {
    date: "Date",
    event: "Event",
    /** "In 3 days" — the column of relative distances. */
    within: "In",
    category: "Category",
    empty: "Nothing scheduled here yet.",
  },

  /** `aria-label` on the previous/next nav; its words come from `common.pagination`. */
  pagination: "Pagination",
};
