/**
 * Chrome: the strings that appear on every page — header, footer, breadcrumbs, the words a card or
 * a table needs whatever it is listing.
 *
 * English is the reference catalogue. Every other locale is typed against `Messages`, so a key that
 * only exists here is a compile error there, and vice versa.
 */
import type { PluralForms } from "../types";

export const common = {
  siteName: "Until",
  tagline: "a catalog of things that haven’t happened yet.",
  /** Footer line: "Until — a catalog of things that haven’t happened yet." */
  wordmarkLine: "Until — a catalog of things that haven’t happened yet.",

  nav: {
    categories: "Categories",
    countries: "Countries",
    daysUntil: "Days until",
    create: "Create",
    about: "About",
  },

  search: {
    label: "Search",
    navLabel: "Search countdowns",
    placeholder: "Search the catalog…",
    navPlaceholder: "Search eclipses, World Cups, holidays…",
    submit: "Search",
  },

  breadcrumb: {
    home: "Home",
  },

  footer: {
    datesCount: { one: "{n} date", other: "{n} dates" } as PluralForms,
    aboutTheData: "about the data",
    attributions: "attributions",
    categories: "Categories",
    browse: "Browse",
    all: "all →",
    makeYourOwn: "Make your own",
    language: "Language",
  },

  actions: {
    share: "Share",
    shareCopied: "Link copied",
    save: "Save",
    saved: "Saved",
    addToCalendar: "Add to calendar",
    google: "Google Calendar",
    outlook: "Outlook",
    downloadIcs: "Download .ics",
    embed: "Embed on your site",
    stream: "Add to your stream",
    copy: "Copy",
    copied: "Copied",
  },

  labels: {
    worldwide: "Worldwide",
    countriesCount: { one: "{n} country", other: "{n} countries" } as PluralForms,
    recurring: "Recurring",
    series: "Series",
    today: "Today",
    tba: "TBA",
    dateToBeAnnounced: "a date to be announced",
    nothingHereYet: "Nothing here yet",
    more: "More",
    seeAll: "See all →",
    loading: "Loading…",
    source: "Source",
    sources: "Sources",
    lastVerified: "Last verified",
  },

  status: {
    scheduled: "Scheduled",
    tentative: "Tentative",
    postponed: "Postponed",
    cancelled: "Cancelled",
    done: "Done",
    retired: "Retired",
  },

  units: {
    days: "days",
    hours: "hours",
    minutes: "minutes",
    seconds: "seconds",
    daysShort: "d",
    hoursShort: "h",
    minutesShort: "m",
    secondsShort: "s",
  },

  pagination: {
    previous: "Previous",
    next: "Next",
    page: "Page {n}",
    pageOf: "Page {n} of {total}",
  },

  languageSwitcher: {
    label: "Language",
    /** `title` on the switcher, and its screen-reader legend. */
    description: "Read Until in another language",
  },
};
