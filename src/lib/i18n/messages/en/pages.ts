/**
 * The prose pages: /about, /attributions, the wrapper around the create form, and the 404.
 *
 * Long-form copy, so the unit is the paragraph and never the clause — a language that puts the
 * verb last, or the number after the noun, can only rearrange a sentence it has all of. Counts
 * that fall inside a sentence arrive as `{n}`; the names of datasets, licences and fonts are
 * proper nouns that read the same everywhere, so where one is also a link the sentence keeps a
 * `{placeholder}` and the page splices the link in (see `fillNodes`).
 */
import type { PluralForms } from "../types";

export const pages = {
  about: {
    title: "About",
    description: "How Until collects, tags, and classifies thousands of future dates.",
    eyebrow: "The project",
    heading: "A newspaper of the future",

    intro:
      "Until is a catalog of dates that have not happened yet. Public holidays from nearly every country, scheduled events drawn from Wikipedia year pages and Wikidata, plus a curated layer of the ones people actually wait for — eclipses, World Cups, Olympics, elections, Halley’s Comet.",
    /** `{n}` is however many categories the taxonomy carries, so the sentence cannot go stale. */
    categories:
      "Each row is tagged and classified across {n} categories — holidays, national days, sports, astronomy, space, tech, politics, history, and more. Search the whole set, filter a category, open a live countdown, and add it to a calendar.",
    /** The three datasets arrive as links. Their names are proper nouns and stay as they are. */
    sources:
      "The holiday backbone is the offline {dateHolidays} dataset, extended with {wikidata} and {wikipedia}. Duplicate names on the same day (Christmas in 140 countries) are merged into one countdown. When sources disagree, curated records win. Every event page names its source and when the date was last verified.",
    expected:
      "Dates without a confirmed day are labelled “expected” with the month, quarter, or year the source gives, and they do not tick until a real date is published. The catalog refreshes daily from its sources.",
    yourOwn:
      "You can make your own. Those stay in the browser — no account — and the share link carries the title and date in the URL so anyone can open the same ticking clock.",

    /** The three figures under the prose. Each is a word over a number, not a sentence. */
    stats: {
      dates: "Dates",
      featured: "Featured",
      updated: "Updated",
    },

    byCategory: {
      heading: "By category",
      empty: "The catalog is being filled — check back soon.",
    },

    bySource: {
      heading: "By source",
      empty: "No sources reported yet.",
    },
  },

  attributions: {
    title: "Attributions — where the dates come from",
    description:
      "Every source behind the Until catalog, with its licence and the attribution it asks for: date-holidays, Wikipedia, Wikidata, Hebcal, Launch Library and more.",
    eyebrow: "Sources",
    heading: "Attributions",
    intro:
      "Until only ingests sources whose terms allow storing and republishing the data. Share-alike sources (Wikipedia text, TVMaze, date-holidays data) are credited on every page that uses them; images are re-hosted only under CC0, public domain, CC BY or CC BY-SA licences with the author named. Each event page links back to the record it was built from.",
    /** The list below it is source names and licence codes, which no language translates. */
    sourcesEmpty: "Source list unavailable right now.",

    images: {
      heading: "Images",
      policy:
        "Photos are re-hosted copies, resized and served from our own storage so the original hosts are never hotlinked. Only freely licensed files are accepted — CC0, public domain, CC BY, CC BY-SA and a few national open-government licences, plus NASA imagery under its media guidelines. Fair-use files, non-commercial (NC) and no-derivatives (ND) licences are rejected outright, as are files carrying a trademark or personality restriction, and every stored file keeps its author, licence and a link back to the file page. Events with no free photo get a generated card instead.",
      shareAlike:
        "Share-alike photos (CC BY-SA) are published unmodified, at their own proportions, with the credit beneath them. They are never cropped into a social card: that composite would be a derivative work and would have to carry the same share-alike licence, so those cards use the generated design instead. Stored files are re-verified against their source monthly; one that has been deleted or is no longer free is removed from our storage and its pages fall back to the generated card.",
      empty: "No re-hosted images yet.",
      /** Introduces the per-licence tally, so it ends in whatever punctuation the language opens a list with. */
      count: {
        one: "{n} image in the library today:",
        other: "{n} images in the library today:",
      } as PluralForms,
    },

    /** Two typefaces and one library, named by their licences: proper nouns inside a sentence. */
    fonts:
      "Fonts: Fraunces (SIL Open Font License) and Geist (SIL Open Font License). Astronomy computed with astronomy-engine (MIT).",
  },

  create: {
    title: "Create a countdown",
    description: "Make a personal countdown and add it to your calendar.",
    eyebrow: "Your dates",
    heading: "Make a countdown",
    intro:
      "Birthdays, launches, a trip, a court date, a reunion. It ticks the same as the catalog — and you can drop it straight into Google Calendar, Outlook, or an .ics file.",

    /** Handed to `CreateForm` as one prop: a Client Component cannot read the catalogue itself. */
    form: {
      /** What the Title field starts with, and therefore what the preview clock is titled. */
      draftTitle: "Something I am waiting for",
      /** Stands in for the Note when it is left empty, on the preview and in the share payload. */
      draftNote: "A countdown you made.",
      titleLabel: "Title",
      dateLabel: "Date",
      categoryLabel: "Category",
      noteLabel: "Note",
      notePlaceholder: "Why this date matters to you.",
      save: "Save on this device",
      openShareable: "Open shareable page",
      /** `{link}` is the sentence's own link, whose words are `savedLink` below. */
      saved: "Saved. {link} — it lives in this browser until you clear storage.",
      savedLink: "View it",
      privacy:
        "Custom countdowns stay on your device (no account). The share link encodes the title and date in the URL.",
      previewLabel: "Live preview",
      chooseDate: "Choose a date to start the clock.",
    },
  },

  notFound: {
    heading: "This date is not in the catalog",
    body: "It may have been merged, renamed, or never existed.",
    backHome: "Back to everything coming",
  },
};
