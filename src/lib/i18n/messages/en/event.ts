/**
 * The event page: one dated occurrence, the sentence that answers the query behind it, and the
 * personal countdowns a reader keeps in their own browser.
 *
 * `answer.*` is the most valuable block in this file. It is the server-rendered sentence a search
 * engine reads first, so each case is a whole template rather than a fragment to glue together —
 * "in 3 days" is not the same shape of clause in Polish, Arabic or Japanese as it is in English.
 */
import type { PluralForms } from "../types";

export const event = {
  /**
   * The intent sentence, one template per case. `{title}` is the entity, `{date}` the long date,
   * `{n}` the day count from SQL. `days` and `past` are chosen by the locale's plural rules;
   * `tomorrow` gets `{n}` too, so a language that counts the day still has the number to hand.
   */
  answer: {
    today: "{title} is today, {date}.",
    tomorrow: "There is {n} day until {title}, tomorrow, {date}.",
    days: {
      one: "There is {n} day until {title}, on {date}.",
      other: "There are {n} days until {title}, on {date}.",
    } as PluralForms,
    past: {
      one: "{title} was {n} day ago, on {date}.",
      other: "{title} was {n} days ago, on {date}.",
    } as PluralForms,
    cancelled: "{title} was scheduled for {date} and has been cancelled.",
    coarse: "{title} is expected {period}. The exact day has not been announced yet.",
    plain: "{title} is on {date}.",
  },

  /**
   * The `done` badge. Not `common.status.done`: the pill says what became of the date, while the
   * status names describe the row.
   */
  statusHappened: "Happened",

  /** A row that runs for more than one day: two compact dates, joined the way the locale joins them. */
  dateRange: "{start} – {end}",

  coarseNote:
    "The exact day has not been announced yet. This page will start ticking once the source publishes one.",
  dateChanged: "Date changed: previously {date}.",
  /** `{series}` is a link to the evergreen series page. */
  partOfSeries: "Part of the {series} series — every year, with the next date always on top.",
  everyUpcomingDate: "Every upcoming date",
  otherYears: "Other years",
  alsoComing: "Also coming",

  fields: {
    where: "Where",
    tags: "Tags",
  },

  provenance: {
    /** Label; the source's own name follows it as a link, so keep whatever punctuation that needs. */
    source: "Source:",
    lastVerified: "last verified {date}",
    /**
     * Wikipedia prose is CC BY-SA 4.0 and the credit is a licence condition. Both `{source}` and
     * `{license}` arrive as links, and neither name is translated: the article is the English one,
     * and the licence is named by its code everywhere.
     */
    summary: "Summary from {source} ({license})",
  },

  image: {
    /** Link text when the file has no named author. */
    photo: "Photo",
    /** Label; the author's name follows it, linking the file description page. */
    photoBy: "Photo:",
    via: "via {provider}",
  },

  /** Personal countdowns: the ones a reader made, stored in their browser and nowhere else. */
  mine: {
    missingTitle: "This countdown lives on another device",
    missingBody:
      "Personal countdowns are stored in the browser that created them. If someone shared a link with you, ask them for the shareable URL from the create page.",
    makeNew: "Make a new one",
    onThisDevice: "On this device",
    remove: "Remove",
    savedCount: {
      one: "{n} catalog date saved in this browser.",
      other: "{n} catalog dates saved in this browser.",
    } as PluralForms,
  },
};
