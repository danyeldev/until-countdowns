/**
 * The look-and-feel model behind the two "take it with you" surfaces: an `<iframe>` embed on
 * someone's own site, and a browser source in OBS / Streamlabs.
 *
 * Both are the same document (`/embed/<slug>`); everything a person can change about it — colours,
 * font, size, which units tick, where the clock sits on the canvas — travels in the query string,
 * so a customised countdown is one copy-pasteable URL with no account and no stored state.
 *
 * The query string is untrusted input that ends up in generated CSS and HTML, so parsing is
 * closed: every value is either an enum member, an integer clamped to a range, or a `#rrggbb`
 * colour. Anything else falls back to the preset's value. `parseEmbedTheme()` is the only way to
 * build a theme from a request — `buildEmbedDocument()` never sees a raw parameter.
 */

export const EMBED_PRESETS = ["dark", "light", "amber", "mono", "neon", "clear"] as const;
export type EmbedPreset = (typeof EMBED_PRESETS)[number];

export const EMBED_FONTS = ["serif", "sans", "mono"] as const;
export type EmbedFont = (typeof EMBED_FONTS)[number];

/** `row`: D:H:M:S side by side · `stack`: one unit per line · `compact`: `12d 04:33:21` · `big`: the first unit only, huge. */
export const EMBED_LAYOUTS = ["row", "stack", "compact", "big"] as const;
export type EmbedLayout = (typeof EMBED_LAYOUTS)[number];

/** Where the clock sits inside the frame it is given (an iframe box, or the whole stream canvas). */
export const EMBED_POSITIONS = [
  "top-left", "top", "top-right",
  "left", "center", "right",
  "bottom-left", "bottom", "bottom-right",
] as const;
export type EmbedPosition = (typeof EMBED_POSITIONS)[number];

/** Which units tick. Always a contiguous slice of days → hours → minutes → seconds. */
export const EMBED_UNITS = ["dhms", "dhm", "dh", "d", "hms", "hm", "ms"] as const;
export type EmbedUnits = (typeof EMBED_UNITS)[number];

export const EMBED_FRAMES = ["card", "outline", "none"] as const;
export type EmbedFrame = (typeof EMBED_FRAMES)[number];

export const EMBED_SEPARATORS = ["colon", "dot", "space", "none"] as const;
export type EmbedSeparator = (typeof EMBED_SEPARATORS)[number];

export type EmbedTheme = {
  preset: EmbedPreset;
  /** Digits and accents. `#rrggbb`. */
  accent: string;
  /** Title, labels and the rest of the type. `#rrggbb`. */
  text: string;
  /** `#rrggbb`, or `transparent` — which is what OBS needs to key the overlay over the scene. */
  bg: string;
  font: EmbedFont;
  /** Percent of the base type scale, 40–400. */
  scale: number;
  layout: EmbedLayout;
  position: EmbedPosition;
  units: EmbedUnits;
  frame: EmbedFrame;
  separator: EmbedSeparator;
  /** Corner radius of the frame, px (0–48). Ignored when `frame` is `none`. */
  radius: number;
  /** Space between the frame and the clock, px (0–96). */
  padding: number;
  labels: boolean;
  title: boolean;
  date: boolean;
  note: boolean;
  /** The "Until" wordmark linking back to the countdown page. */
  brand: boolean;
  glow: boolean;
  /** Drop leading units while they are still zero (`00d 00h 12m 30s` → `12m 30s`). */
  trim: boolean;
  /** Replaces "It's here." once the countdown reaches zero. Empty string keeps the default. */
  done: string;
};

export const SCALE_MIN = 40;
export const SCALE_MAX = 400;
export const RADIUS_MAX = 48;
export const PADDING_MAX = 96;
export const DONE_MAX = 60;

/** Canvas an overlay is authored against; also the browser-source size the stream tab recommends. */
export const STREAM_CANVAS = { width: 1920, height: 1080 } as const;
/** Default `<iframe>` box for a website embed. */
export const EMBED_BOX = { width: 480, height: 220 } as const;

type Palette = Pick<EmbedTheme, "accent" | "text" | "bg"> & Partial<Pick<EmbedTheme, "frame" | "glow" | "font">>;

/**
 * Named starting points. `dark` is the site's own palette; `clear` is the streaming default —
 * no background, no frame, so only the type lands on the scene.
 */
export const PRESET_PALETTES: Record<EmbedPreset, Palette> = {
  dark: { accent: "#f0a202", text: "#f3ece0", bg: "#161410" },
  light: { accent: "#b06d00", text: "#1a1713", bg: "#f7f3ea" },
  amber: { accent: "#0c0b09", text: "#3a2f14", bg: "#f0a202" },
  mono: { accent: "#ffffff", text: "#c9c0b0", bg: "#000000", glow: false, font: "mono" },
  neon: { accent: "#39ff88", text: "#eaffef", bg: "#04120a" },
  clear: { accent: "#ffffff", text: "#ffffff", bg: "transparent", frame: "none" },
};

export const PRESET_LABELS: Record<EmbedPreset, string> = {
  dark: "Until dark",
  light: "Light",
  amber: "Amber",
  mono: "Mono",
  neon: "Neon",
  clear: "Transparent",
};

const BASE: Omit<EmbedTheme, "preset" | "accent" | "text" | "bg"> = {
  font: "mono",
  scale: 100,
  layout: "row",
  position: "center",
  units: "dhms",
  frame: "card",
  separator: "colon",
  radius: 24,
  padding: 24,
  labels: true,
  title: true,
  date: false,
  note: false,
  brand: true,
  glow: true,
  trim: false,
  done: "",
};

/** The theme a preset means on its own, before any explicit override in the query string. */
export function presetTheme(preset: EmbedPreset): EmbedTheme {
  const palette = PRESET_PALETTES[preset];
  return { ...BASE, ...palette, preset };
}

export const DEFAULT_EMBED_THEME: EmbedTheme = presetTheme("dark");
/** What the "Add to your stream" tab starts from: transparent, unframed, bottom-left of the canvas. */
export const STREAM_EMBED_THEME: EmbedTheme = { ...presetTheme("clear"), position: "bottom-left", padding: 48 };

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Anything a Next route can hand over as a query string. */
export type EmbedParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>
  | undefined
  | null;

function reader(input: EmbedParamsInput): (key: string) => string | undefined {
  if (!input) return () => undefined;
  if (input instanceof URLSearchParams) {
    return (key) => input.get(key) ?? undefined;
  }
  return (key) => {
    const value = input[key];
    // Next hands a repeated parameter over as an array; the first occurrence wins.
    if (Array.isArray(value)) return value[0];
    return value ?? undefined;
  };
}

const HEX = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * `#rrggbb` from `f0a202`, `#F0A202` or `#fa2`; `null` for anything else. The `#` is optional so a
 * colour survives a query string that was not encoded (`?accent=f0a202`).
 */
export function parseColor(value: string | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!HEX.test(raw)) return null;
  const hex = (raw.startsWith("#") ? raw.slice(1) : raw).toLowerCase();
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  return `#${full}`;
}

const TRANSPARENT_WORDS = new Set(["transparent", "none", "clear", "chroma"]);

/** Background colour, where the words that mean "let the scene through" also parse. */
export function parseBackground(value: string | undefined): string | null {
  if (!value) return null;
  if (TRANSPARENT_WORDS.has(value.trim().toLowerCase())) return "transparent";
  return parseColor(value);
}

function parseEnum<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  if (!value) return null;
  const needle = value.trim().toLowerCase();
  return (allowed as readonly string[]).includes(needle) ? (needle as T) : null;
}

function parseInt10(value: string | undefined, min: number, max: number): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** `1`/`0`, `true`/`false`, `yes`/`no`, `on`/`off`; a bare `?labels` reads as true. */
function parseBool(value: string | undefined): boolean | null {
  if (value === undefined) return null;
  const raw = value.trim().toLowerCase();
  if (raw === "" || raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true;
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
  return null;
}

/** Collapses whitespace and clamps the length; the HTML builder escapes what comes out. */
function parseText(value: string | undefined, max: number): string | null {
  if (value === undefined) return null;
  const clean = value.replace(/\s+/g, " ").trim().slice(0, max);
  return clean;
}

function pick<T>(parsed: T | null, fallback: T): T {
  return parsed === null ? fallback : parsed;
}

/**
 * A complete theme from a query string. Unknown, malformed or out-of-range values are ignored in
 * favour of the preset's own — a broken URL still renders a countdown someone can read.
 */
export function parseEmbedTheme(input: EmbedParamsInput, fallback: EmbedTheme = DEFAULT_EMBED_THEME): EmbedTheme {
  const get = reader(input);
  const preset = parseEnum(get("preset") ?? get("theme"), EMBED_PRESETS);
  const base = preset ? presetTheme(preset) : fallback;

  return {
    preset: base.preset,
    accent: pick(parseColor(get("accent")), base.accent),
    text: pick(parseColor(get("text")), base.text),
    bg: pick(parseBackground(get("bg")), base.bg),
    font: pick(parseEnum(get("font"), EMBED_FONTS), base.font),
    scale: pick(parseInt10(get("scale"), SCALE_MIN, SCALE_MAX), base.scale),
    layout: pick(parseEnum(get("layout"), EMBED_LAYOUTS), base.layout),
    position: pick(parseEnum(get("pos"), EMBED_POSITIONS), base.position),
    units: pick(parseEnum(get("units"), EMBED_UNITS), base.units),
    frame: pick(parseEnum(get("frame"), EMBED_FRAMES), base.frame),
    separator: pick(parseEnum(get("sep"), EMBED_SEPARATORS), base.separator),
    radius: pick(parseInt10(get("radius"), 0, RADIUS_MAX), base.radius),
    padding: pick(parseInt10(get("pad"), 0, PADDING_MAX), base.padding),
    labels: pick(parseBool(get("labels")), base.labels),
    title: pick(parseBool(get("title")), base.title),
    date: pick(parseBool(get("date")), base.date),
    note: pick(parseBool(get("note")), base.note),
    brand: pick(parseBool(get("brand")), base.brand),
    glow: pick(parseBool(get("glow")), base.glow),
    trim: pick(parseBool(get("trim")), base.trim),
    done: pick(parseText(get("done"), DONE_MAX), base.done),
  };
}

// ---------------------------------------------------------------------------
// Serialising
// ---------------------------------------------------------------------------

const BOOL_KEYS: [key: keyof EmbedTheme, param: string][] = [
  ["labels", "labels"],
  ["title", "title"],
  ["date", "date"],
  ["note", "note"],
  ["brand", "brand"],
  ["glow", "glow"],
  ["trim", "trim"],
];

/**
 * The shortest query string that reproduces `theme`: the preset (unless it is the default one)
 * plus only what differs from that preset. Switching preset therefore shortens the URL again
 * instead of freezing the old palette into it.
 */
export function embedQuery(theme: EmbedTheme): string {
  const base = presetTheme(theme.preset);
  const usp = new URLSearchParams();
  if (theme.preset !== DEFAULT_EMBED_THEME.preset) usp.set("preset", theme.preset);
  if (theme.accent !== base.accent) usp.set("accent", theme.accent);
  if (theme.text !== base.text) usp.set("text", theme.text);
  if (theme.bg !== base.bg) usp.set("bg", theme.bg);
  if (theme.font !== base.font) usp.set("font", theme.font);
  if (theme.scale !== base.scale) usp.set("scale", String(theme.scale));
  if (theme.layout !== base.layout) usp.set("layout", theme.layout);
  if (theme.position !== base.position) usp.set("pos", theme.position);
  if (theme.units !== base.units) usp.set("units", theme.units);
  if (theme.frame !== base.frame) usp.set("frame", theme.frame);
  if (theme.separator !== base.separator) usp.set("sep", theme.separator);
  if (theme.radius !== base.radius) usp.set("radius", String(theme.radius));
  if (theme.padding !== base.padding) usp.set("pad", String(theme.padding));
  for (const [key, param] of BOOL_KEYS) {
    if (theme[key] !== base[key]) usp.set(param, theme[key] ? "1" : "0");
  }
  if (theme.done !== base.done) usp.set("done", theme.done);
  return usp.toString();
}

/** `/embed/<slug>` with the theme attached. Relative by design: callers add their own origin. */
export function embedPath(slug: string, theme: EmbedTheme): string {
  const query = embedQuery(theme);
  return `/embed/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`;
}

export function embedUrl(origin: string, slug: string, theme: EmbedTheme): string {
  return `${origin.replace(/\/$/, "")}${embedPath(slug, theme)}`;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * The `<iframe>` snippet the embed tab hands over. `width` is a percentage string by default so the
 * widget follows its column; the height has to be a number because an iframe cannot size itself.
 */
export function embedIframeSnippet(
  url: string,
  title: string,
  size: { width: number | string; height: number } = { width: "100%", height: EMBED_BOX.height },
): string {
  // The attribute takes a bare number, the declaration needs a unit — `width:480` is simply dropped.
  const attribute = typeof size.width === "number" ? String(size.width) : size.width;
  const declared = typeof size.width === "number" ? `${size.width}px` : size.width;
  return [
    `<iframe src="${escapeAttribute(url)}"`,
    ` title="${escapeAttribute(`${title} countdown`)}"`,
    ` width="${escapeAttribute(attribute)}" height="${size.height}"`,
    ` loading="lazy" style="border:0;width:${escapeAttribute(declared)};height:${size.height}px;max-width:100%"`,
    `></iframe>`,
  ].join("");
}
