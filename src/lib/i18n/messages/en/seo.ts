/**
 * Titles and descriptions — the part of the site a search engine reads first, and the reason it is
 * translated at all.
 *
 * "How many days until X" is not one phrase with fifteen spellings; it is fifteen different queries
 * ("cuántos días faltan para", "wie viele Tage bis", "kaç gün kaldı"). Each locale writes its own
 * natural phrasing here — a literal translation of the English template is the wrong answer if
 * nobody types it into a search box.
 *
 * Rules that hold in every language:
 * - a title never carries the day count (it goes stale in the index; the description carries it,
 *   from the SQL-computed `days_until`);
 * - a description stays under ~155 characters after filling, or it is truncated with an ellipsis;
 * - `{title}` is the event's own name and is never bent to fit — it is the thing being searched for.
 */
import type { PluralForms } from "../types";

export const seo = {
  /** Root layout default, and the home page's absolute title. Names the site, so no template suffix. */
  homeTitle: "Until — countdowns for everything coming",
  siteDescription:
    "Thousands of future dates, tagged and ticking. Holidays, eclipses, World Cups, elections — plus the ones you make yourself.",
  /**
   * Next's title template for every other page — `%s` is the page's own title. A locale that
   * separates differently (Japanese tends to use "｜") changes it here.
   */
  titleTemplate: "%s · Until",

  /**
   * One-off event titles, rotated by category (`TITLE_STYLE` in src/lib/seo.ts decides which style a
   * category uses) so the corpus is not one template repeated 40,000 times.
   */
  event: {
    whenIs: "When is {title}? {when}",
    whenIsCoarse: "When is {title}? Expected {period}",
    countdownColon: "{title} countdown: {when}",
    countdownDash: "{title} — {when} countdown",
    /** "2026 Alpine Skiing World Cup — expected 2026" rather than "… — 2026 countdown". */
    countdownDashCoarse: "{title} — {when}",
    description: "{title}{status} is on {date}. {days} Live countdown, add to calendar.",
    descriptionCoarse:
      "{title} is expected {period}. The exact day is not announced yet. Live countdown once it is, add to calendar.",
    statusCancelled: " (cancelled)",
    statusPostponed: " (postponed)",
    /** Metadata for rows that could not be read; never indexed. */
    fallbackTitle: "Countdown",
    mineTitle: "Your countdown",
    sharedTitle: "Shared countdown",
    sharedMetaTitle: "{title} — {date} countdown",
    sharedMetaDescription: "{title} is on {date}. A countdown someone made on Until.",
  },

  /** The evergreen pages. This is the highest-volume phrasing on the site — get it idiomatic. */
  series: {
    title: "How many days until {title}? — {when}",
    titleNoDate: "How many days until {title}?",
    /** The `<h1>`, which should read as the question a person typed. */
    heading: "How many days until {title}?",
    description: "{title} is on {date}. {days} Live countdown, dates for every year, add to calendar.",
    descriptionCoarse:
      "The next {title} is expected {period}. Dates for every year, live countdown, add to calendar.",
    descriptionNoDate: "{title}: upcoming dates, a live countdown to the next one, and calendar links.",
    fallbackTitle: "Days until",
  },

  hub: {
    category: "Upcoming {category} — countdowns and dates",
    country: "{country}: upcoming holidays and events",
    month: "{month} — what is coming up",
    tag: "{tag} — upcoming dates and countdowns",
    /**
     * Whether `{category}` is lower-cased before it goes into the title above. English reads
     * "Upcoming holidays"; German capitalises every noun and must not.
     */
    lowercaseCategory: true,
  },

  /** "That is 107 days away." — the sentence that carries the day count into the description. */
  days: {
    today: "That is today.",
    tomorrow: "That is tomorrow.",
    yesterday: "That was yesterday.",
    away: { one: "That is {n} day away.", other: "That is {n} days away." } as PluralForms,
    ago: { one: "That was {n} day ago.", other: "That was {n} days ago." } as PluralForms,
  },

  /** Coarse precisions: the period on its own, and the phrase that introduces it. */
  period: {
    month: "{month} {year}",
    quarter: "Q{q} {year}",
    year: "{year}",
    expected: "expected {period}",
    unknown: "date to be announced",
  },

  jsonLd: {
    siteDescription: "Live countdowns and dates for thousands of upcoming events, holidays and milestones.",
    seriesDescription: "Upcoming dates of {title}.",
  },
};
