/**
 * The eight hub pages: the two indexes (categories, countries), one category, one country, one
 * calendar month, one tag, and the paginated tail of the category and tag hubs.
 *
 * A hub's *title* is built in `src/lib/seo.ts` from `seo.hub.*`, because a title is a query and the
 * four hub titles have to rhyme with the event and series ones. What is here is everything the page
 * itself says: the description under the title, the headings, and the count line — each one whole
 * sentence, so a translator can put its pieces in the order their language wants rather than the
 * order English wanted.
 */
import type { PluralForms } from "../types";

export const hubs = {
  /**
   * The hub's own word: the tracked label above the `<h1>`, and the `<title>` of a URL that names
   * no real category, country, month or tag — those are `noindex`, and only ever reached by hand.
   */
  label: {
    browse: "Browse",
    category: "Category",
    country: "Country",
    calendar: "Calendar",
    tag: "Tag",
  },

  /** `aria-label` of the trail itself; its first crumb is `common.breadcrumb.home`. */
  breadcrumbLabel: "Breadcrumb",

  /** Page 2+ of a paginated hub. Never indexed, but a reader still lands on one from a search. */
  paged: {
    title: "{name} (page {n})",
    /** Muted, next to the `<h1>` the hub already carries. */
    headingSuffix: "— page {n}",
    /** A whole sentence, full stop included: the link is the sentence. */
    backToFirst: "Back to the first page.",
  },

  categoryIndex: {
    title: "Categories — every kind of date that has not happened yet",
    description:
      "Browse upcoming dates by category: holidays, sports, film and TV, games, space, elections, anniversaries and more, each with live countdowns.",
    heading: "Every kind of date",
    intro: "Twenty-three categories, grouped by what you would do with them.",
    collectionDescription: "Upcoming dates by category.",
  },

  category: {
    /** `{blurb}` is the category's own line from `categories.blurbs`, and is already a sentence. */
    description: {
      one: "{blurb} {n} upcoming date with a live countdown and calendar links.",
      other: "{blurb} {n} upcoming dates with live countdowns and calendar links.",
    } as PluralForms,
    /** An empty category is kept out of the index, but it still needs a description that reads. */
    descriptionEmpty: "{blurb} Upcoming dates with live countdowns and calendar links.",
    descriptionPaged:
      "{blurb} Page {n} of the upcoming dates, soonest first, with live countdowns and calendar links.",
    /** `{category}` is the label, lower-cased where `seo.hub.lowercaseCategory` says a language does. */
    heading: "Upcoming {category}",
    count: { one: "{n} upcoming date.", other: "{n} upcoming dates." } as PluralForms,
    countPaged: {
      one: "{n} upcoming date, soonest first.",
      other: "{n} upcoming dates, soonest first.",
    } as PluralForms,
    soon: "Next 30 days",
    everyYear: "Every year",
    all: "All upcoming {category}",
    empty: "Nothing in this category yet.",
  },

  countryIndex: {
    title: "Countries — upcoming holidays and events by country",
    description:
      "Public holidays, national days and local events for more than 200 countries and territories, each with live countdowns and calendar links.",
    heading: "By country",
    intro: {
      one: "{n} country and territory with upcoming holidays and events in the catalog.",
      other: "{n} countries and territories with upcoming holidays and events in the catalog.",
    } as PluralForms,
    empty: "The catalog is being filled — check back soon.",
    collectionDescription: "Upcoming holidays and events by country.",
  },

  country: {
    description: {
      one: "Public holidays, national days and events in {country} — {n} upcoming date, grouped by month, each with a live countdown and calendar links.",
      other:
        "Public holidays, national days and events in {country} — {n} upcoming dates, grouped by month, each with a live countdown and calendar links.",
    } as PluralForms,
    descriptionEmpty:
      "Public holidays, national days and events in {country}, grouped by month, each with a live countdown and calendar links.",
    intro:
      "Upcoming holidays and events tagged {country}, month by month. Worldwide dates — eclipses, releases, international days — are listed separately below.",
    count: { one: "{n} upcoming date.", other: "{n} upcoming dates." } as PluralForms,
    /** The read is capped, so a busy country says "250+" rather than a total it cannot stand behind. */
    countCapped: { one: "{n}+ upcoming date.", other: "{n}+ upcoming dates." } as PluralForms,
    empty: "No dates tagged {country} yet.",
    worldwide: "Worldwide, coming up",
    collectionDescription: "Holidays and events in {country}.",
  },

  calendar: {
    description:
      "Everything in the catalog for {month}: holidays, launches, finals, premieres and anniversaries, day by day, with live countdowns.",
    count: {
      one: "{n} upcoming date in {month}, day by day.",
      other: "{n} upcoming dates in {month}, day by day.",
    } as PluralForms,
    empty: "Nothing upcoming in {month} yet.",
    /** `aria-label` of the prev/next nav, then its two links — the arrow carries the reading direction. */
    months: "Months",
    previous: "← {month}",
    next: "{month} →",
    collectionDescription: "Upcoming dates in {month}.",
  },

  tag: {
    description: {
      one: "{n} upcoming date tagged \"{tag}\", soonest first, with a live countdown and calendar links.",
      other:
        "{n} upcoming dates tagged \"{tag}\", soonest first, each with a live countdown and calendar links.",
    } as PluralForms,
    descriptionPaged:
      "Page {n} of the upcoming dates tagged \"{tag}\", soonest first, each with a live countdown and calendar links.",
    /** The breadcrumb, where the hash is what says "this is a tag" rather than a section. */
    crumb: "#{tag}",
    count: {
      one: "{n} upcoming date tagged “{tag}”, soonest first.",
      other: "{n} upcoming dates tagged “{tag}”, soonest first.",
    } as PluralForms,
    searchPrompt: "Looking for something else?",
    /** A whole sentence, full stop included: the link is the sentence. */
    searchLink: "Search the whole catalog for “{tag}”.",
    collectionDescription: "Upcoming dates tagged {tag}.",
  },
};
