/**
 * The widget studio and the ticking clock — every word *around* the embed, and none of the words
 * inside it.
 *
 * The document at `/embed/<slug>` is built by `src/lib/embed/html.ts` and stays English in every
 * locale: it lands on somebody else's page, it is `noindex`, and it has no locale of its own to
 * inherit. So nothing here is the widget's copy; it all belongs to the panel a person builds it in.
 */
import type { PluralForms } from "../types";

export const embed = {
  /** The live clock on cards, heroes and personal countdowns. */
  countdown: {
    units: {
      /** Under the day figure. It is the only unit written out, so it is the only one that inflects. */
      days: { one: "day", other: "days" } as PluralForms,
      /** Abbreviations under the two-digit cells; short enough that a 2ch column still reads. */
      hours: "hrs",
      minutes: "min",
      seconds: "sec",
    },
    /** A sentence, not the badge word in `common.labels.today`: the clock has stopped, the day has not. */
    today: "Today.",
    past: "This one already happened.",
  },

  studio: {
    heading: "Take it with you",

    controls: {
      preset: "Preset",
      digits: "Digits",
      type: "Type",
      background: "Background",
      transparent: "Transparent — lets the scene or the page through",
      font: "Font",
      size: "Size",
      layout: "Layout",
      units: "Units",
      separator: "Separator",
      frame: "Frame",
      radius: "Corner radius",
      inset: "Edge inset",
      position: "Position",
      done: "Finished message",
      reset: "Reset",
      /** Names the swatch beside a colour field for a screen reader; `{label}` is that field's own name. */
      colourPicker: "{label} — colour picker",
    },

    /** The switches, one per part of the widget a person can turn off. */
    toggles: {
      unitLabels: "Unit labels",
      title: "Title",
      date: "Date",
      note: "Note",
      wordmark: "Wordmark",
      glow: "Glow",
      trim: "Trim leading zeros",
    },

    presets: {
      dark: "Until dark",
      light: "Light",
      amber: "Amber",
      mono: "Mono",
      neon: "Neon",
      clear: "Transparent",
    },

    fonts: {
      serif: "Serif",
      sans: "Sans",
      mono: "Mono",
    },

    layouts: {
      row: "Row",
      stack: "Stacked",
      compact: "Compact",
      big: "One big number",
    },

    separators: {
      colon: "Colon",
      dot: "Dot",
      space: "Space",
      none: "None",
    },

    frames: {
      card: "Card",
      outline: "Outline",
      none: "None",
    },

    /** Which units tick. Always a contiguous run of days → hours → minutes → seconds. */
    units: {
      dhms: "Days · hours · minutes · seconds",
      dhm: "Days · hours · minutes",
      dh: "Days · hours",
      d: "Days",
      hms: "Hours · minutes · seconds",
      hm: "Hours · minutes",
      ms: "Minutes · seconds",
    },

    /** The position picker is a grid of dots, so these words only ever reach a screen reader. */
    positions: {
      "top-left": "Top left",
      top: "Top",
      "top-right": "Top right",
      left: "Left",
      center: "Center",
      right: "Right",
      "bottom-left": "Bottom left",
      bottom: "Bottom",
      "bottom-right": "Bottom right",
    },

    copy: {
      code: "Copy code",
      url: "Copy URL",
    },

    embed: {
      previewTitle: "Embed preview",
      paste: "Paste this into your page",
      codeLabel: "Embed code",
      note: "It drops in at full width and {height}px tall. WordPress, Ghost and Notion also accept the countdown’s own link and find the embed themselves — but that unfurls the standard card, so paste the code above to keep what you have built here.",
    },

    stream: {
      previewTitle: "Stream overlay preview",
      canvasNote: "The {width} × {height} canvas, scaled down — the chequerboard is what OBS keys out.",
      urlLabel: "Browser source URL",
      /** Beside the copy button: what to add in OBS, and at what size. */
      source: "Browser source · {width} × {height}",
      steps: [
        "In OBS or Streamlabs, add a Browser source.",
        "Paste the URL above.",
        "Set the size to {width} × {height} — the canvas the position is measured against.",
        "Leave the background transparent; the overlay brings its own.",
        "Tick “Refresh browser when scene becomes active” so the clock starts fresh.",
      ],
    },
  },
};
