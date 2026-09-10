/**
 * The embed document — the whole of `/embed/<slug>`, as one string.
 *
 * Deliberately not a React page. This document lands inside other people's pages and inside OBS's
 * browser source, so it ships self-contained: inline CSS, a ~40-line inline ticker, no React, no
 * hydration, no webfont, no third-party request of any kind. Nothing here may reach for a URL the
 * host page did not ask for.
 *
 * The theme it renders comes from a query string, so this module is the security boundary: text is
 * escaped, and every colour and number is re-validated here before it reaches a CSS declaration —
 * `parseEmbedTheme()` already closed that door, and this closes it again from the inside.
 */
import { longDate } from "@/lib/i18n/format";
import { truncate } from "@/lib/seo";
import { PADDING_MAX, RADIUS_MAX, SCALE_MAX, SCALE_MIN } from "./theme";
import type { EmbedLayout, EmbedTheme } from "./theme";

export type EmbedSubject = {
  /** Slug the embed was reached at — also what the click-through and oEmbed use. */
  slug: string;
  title: string;
  description: string;
  /** `YYYY-MM-DD` for an all-day date, or a full ISO instant. */
  date: string;
  allDay: boolean;
  /** Absolute URL of the countdown's own page on Until. */
  href: string;
};

// ---------------------------------------------------------------------------
// Escaping and re-validation
// ---------------------------------------------------------------------------

/** Every interpolated text value goes through this — attribute values included, hence `"` and `'`. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only ever an http(s) or site-relative target: a hand-built subject cannot smuggle in `javascript:`. */
function safeHref(href: string, fallback = "/"): string {
  return /^(?:https?:\/\/|\/(?!\/))/i.test(href.trim()) ? href.trim() : fallback;
}

/** A colour is used only where a colour belongs, so it has to look like one — `;` can never survive. */
function hex(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}

/** Same idea for lengths: an integer in range, and the `px` is added here rather than carried in. */
function num(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

type Unit = "d" | "h" | "m" | "s";

const UNIT_SECONDS: Record<Unit, number> = { d: 86400, h: 3600, m: 60, s: 1 };
const UNIT_WORDS: Record<Unit, string> = { d: "days", h: "hrs", m: "min", s: "sec" };
/** A no-break space, not a plain one: a flex item holding only collapsible white space has no width. */
const SEPARATOR_CHARS = { colon: ":", dot: "·", space: " ", none: "" } as const;

const FONT_STACKS = {
  serif: 'Fraunces, "Iowan Old Style", Georgia, serif',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, "Geist Mono", SFMono-Regular, Menlo, Consolas, monospace',
} as const;

/**
 * The units the clock draws. `big` shows only the first, and that is also all the ticker needs to
 * walk: the leading unit's value never depends on the ones below it.
 */
function clockUnits(theme: EmbedTheme): Unit[] {
  const parsed = theme.units.split("").filter((u): u is Unit => u === "d" || u === "h" || u === "m" || u === "s");
  // A hand-built theme could name no unit at all; an empty clock is worse than the default one.
  const all: Unit[] = parsed.length ? parsed : ["d", "h", "m", "s"];
  return theme.layout === "big" ? all.slice(0, 1) : all;
}

/** The largest enabled unit absorbs everything above it — `units=hms` on three days shows 76 hours. */
function splitRemaining(units: Unit[], totalSeconds: number): number[] {
  let rem = Math.max(0, totalSeconds);
  return units.map((unit) => {
    const value = Math.floor(rem / UNIT_SECONDS[unit]);
    rem -= value * UNIT_SECONDS[unit];
    return value;
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** An all-day date is UTC midnight here; the ticker re-reads it as LOCAL midnight (see `tickerScript`). */
function targetInstant(subject: EmbedSubject): number {
  const dateOnly = subject.allDay && !subject.date.includes("T");
  if (!dateOnly) return Date.parse(subject.date);
  const [y, m, d] = subject.date.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

/** `[y, m, d]` for an all-day date, `null` for a timed instant. Drives both the target and "It's here.". */
function localYmd(subject: EmbedSubject): number[] | null {
  if (!subject.allDay || subject.date.includes("T")) return null;
  const [y, m, d] = subject.date.slice(0, 10).split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return [y, m, d];
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

/**
 * Type sizes are `calc(<base>px * var(--scale))`, capped against the viewport so 400 % scale in a
 * 320px iframe still fits: the budget is roughly 100 / the characters on the widest line — four
 * units side by side (~10), one compact line (~9), a single stacked unit (~18), one huge number
 * (~20). The plain declaration comes first and `min()` second, so an OBS Chromium too old to parse
 * `min()` drops that line and keeps a readable size instead of inheriting one.
 */
function fontSize(base: number, vw: number): string {
  const raw = `calc(${base}px * var(--scale))`;
  return `font-size:${raw};font-size:min(${raw},${vw}vw)`;
}

function layoutRules(layout: EmbedLayout, horizontal: string, labels: boolean): string {
  switch (layout) {
    case "stack":
      return [
        `.clock{display:flex;flex-direction:column;align-items:${horizontal};gap:calc(4px * var(--scale))}`,
        ".u{display:flex;align-items:baseline;gap:calc(8px * var(--scale))}",
        `.v{${fontSize(30, 18)}}`,
        `.l{${fontSize(10, 5)}}`,
      ].join("");
    case "compact":
      return [
        `.clock{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:${horizontal};gap:${labels ? "calc(8px * var(--scale))" : "0"}}`,
        ".u{display:inline-flex;align-items:baseline}",
        `.v{${fontSize(26, 9)}}`,
        // The label is a suffix here ("12d"), not a caption: no tracking, no uppercase, no gap.
        `.l{${fontSize(15, 5)};letter-spacing:0;text-transform:none;opacity:.72}`,
        `.sep{${fontSize(26, 9)};opacity:.5}`,
      ].join("");
    case "big":
      return [
        `.clock{display:flex;justify-content:${horizontal}}`,
        ".u{display:flex;flex-direction:column;align-items:center}",
        `.v{${fontSize(64, 20)}}`,
        `.l{display:block;margin-top:calc(6px * var(--scale));${fontSize(12, 5)}}`,
      ].join("");
    default:
      return [
        `.clock{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:${horizontal};gap:calc(10px * var(--scale))}`,
        ".u{display:flex;flex-direction:column;align-items:center}",
        `.v{${fontSize(34, 10)}}`,
        `.l{display:block;margin-top:calc(4px * var(--scale));${fontSize(10, 4)}}`,
        // With labels on, the separator sits on the digits' baseline rather than the caption's.
        `.sep{${fontSize(26, 8)};opacity:.45${labels ? ";padding-bottom:calc(15px * var(--scale))" : ""}}`,
      ].join("");
  }
}

function css(theme: EmbedTheme): string {
  const accent = hex(theme.accent, "#f0a202");
  const text = hex(theme.text, "#f3ece0");
  // `transparent` is not a fallback — it is what OBS keys the overlay on, so the scene shows through.
  const background = theme.bg === "transparent" ? "transparent" : hex(theme.bg, "#161410");
  const scale = num(theme.scale, SCALE_MIN, SCALE_MAX, 100) / 100;
  const radius = num(theme.radius, 0, RADIUS_MAX, 24);
  // The inset from the canvas / iframe EDGE — what a streamer means by "put it in the corner".
  const padding = num(theme.padding, 0, PADDING_MAX, 24);

  const vertical = theme.position.startsWith("top") ? "flex-start" : theme.position.startsWith("bottom") ? "flex-end" : "center";
  const horizontal = theme.position.endsWith("left") ? "flex-start" : theme.position.endsWith("right") ? "flex-end" : "center";
  const align = horizontal === "flex-start" ? "left" : horizontal === "flex-end" ? "right" : "center";

  // Where the frame carries its own fill, the canvas stays clear so the host page shows through the
  // inset — otherwise a light widget lands on a blog as a coloured rectangle the width of its
  // column, rather than as a card. `outline` and `none` draw no fill, so there `bg` is the canvas.
  const canvas = theme.frame === "card" ? "transparent" : background;

  const inner = "border-radius:" + radius + "px;padding:calc(20px * var(--scale))";
  const frame =
    theme.frame === "none"
      ? "background:none;border:0;padding:0"
      : theme.frame === "outline"
        ? `background:none;border:1px solid ${accent}66;${inner}`
        : `background:${background === "transparent" ? "none" : background};border:1px solid ${text}24;${inner}`;

  return [
    `:root{--scale:${scale};--accent:${accent};--text:${text}}`,
    "*{box-sizing:border-box}",
    "html,body{height:100%;margin:0}",
    `body{min-height:100vh;display:flex;align-items:${vertical};justify-content:${horizontal};text-align:${align};`,
    `padding:${padding}px;background:${canvas};color:${text};font-family:${FONT_STACKS[theme.font]};`,
    "line-height:1.25;-webkit-font-smoothing:antialiased;overflow:hidden}",
    `.card{display:flex;flex-direction:column;align-items:${horizontal};gap:calc(6px * var(--scale));max-width:100%;`,
    // Someone who turned the wordmark off did not ask for a click-through either, but when it is a
    // link it must not look like one inside a host page.
    `color:inherit;text-decoration:none;${frame}}`,
    `.title{margin:0;${fontSize(15, 7)}}`,
    `.v{color:var(--accent);font-variant-numeric:tabular-nums;letter-spacing:-.02em;line-height:1${theme.glow ? `;text-shadow:0 0 calc(28px * var(--scale)) ${accent}59` : ""}}`,
    ".l{letter-spacing:.22em;text-transform:uppercase;opacity:.62}",
    `.meta,.note{margin:0;${fontSize(12, 5)};opacity:.72}`,
    `.brand{margin:0;font-family:${FONT_STACKS.serif};${fontSize(12, 5)};opacity:.55}`,
    `.done{display:none;margin:0;font-family:${FONT_STACKS.serif};font-style:italic;color:var(--accent);${fontSize(20, 8)}}`,
    layoutRules(theme.layout, horizontal, theme.labels),
  ].join("");
}

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function unitLabel(unit: Unit, value: number, layout: EmbedLayout): string {
  if (layout === "compact") return unit;
  return unit === "d" && value === 1 ? "day" : UNIT_WORDS[unit];
}

function renderClock(theme: EmbedTheme, units: Unit[], values: number[], hidden: boolean): string {
  const separator = SEPARATOR_CHARS[theme.separator];
  // Separators belong to the two layouts that read as one line of digits; `stack` and `big` have none,
  // and a compact line with letter suffixes already separates itself.
  const separated = theme.layout === "row" || (theme.layout === "compact" && !theme.labels);
  const parts: string[] = [];
  units.forEach((unit, i) => {
    const label = theme.labels ? `<span class="l">${escapeHtml(unitLabel(unit, values[i], theme.layout))}</span>` : "";
    parts.push(`<span class="u" data-u="${unit}"><span class="v" data-v="${unit}">${pad2(values[i])}</span>${label}</span>`);
    // `data-after` ties the separator to the unit before it, so `trim` can hide the pair together.
    if (separated && separator && i < units.length - 1) {
      parts.push(`<span class="sep" data-after="${unit}">${escapeHtml(separator)}</span>`);
    }
  });
  return `<div class="clock" id="clock"${hidden ? ' style="display:none"' : ""}>${parts.join("")}</div>`;
}

type TickerConfig = {
  ymd: number[] | null;
  iso: string;
  units: Unit[];
  trim: boolean;
  /** `["day","days"]` where the day caption is a word that can go stale; `null` where it cannot. */
  dayLabel: string[] | null;
  here: string;
  past: string;
};

/**
 * ES5 only — `var`, no arrows, no template literals: some OBS installs still ship an embedded
 * Chromium old enough to choke on anything newer, and a syntax error there is a frozen clock.
 *
 * Two things it has to get right that the server cannot. The finished state swaps **both ways**
 * (`show()`): the server decides it from UTC, this clock from the viewer's own midnight, so west of
 * UTC a document rendered as finished still has hours left on it and must un-hide its clock. And a
 * finished countdown keeps a slow pulse instead of clearing its timer, because "It's here." has to
 * become "This one already happened." when the day turns over — a minute's granularity is plenty.
 */
function tickerScript(config: TickerConfig): string {
  // A title (or a custom "done" line) containing `</script>` would otherwise close this element and
  // land as markup; escaping `<` inside the JSON literal keeps it a string.
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `<script>(function(){
var C=${json},S={d:86400,h:3600,m:60,s:1},i,u;
var target=C.ymd?new Date(C.ymd[0],C.ymd[1]-1,C.ymd[2]).getTime():Date.parse(C.iso);
if(isNaN(target))return;
var clock=document.getElementById("clock"),done=document.getElementById("done");
var box=[],val=[],sep=[],dayL=null,timer=null,rate=0,shown=null;
function q(s){return document.querySelector(s)}
for(i=0;i<C.units.length;i++){u=C.units[i];box.push(q('[data-u="'+u+'"]'));val.push(q('[data-v="'+u+'"]'));sep.push(q('[data-after="'+u+'"]'))}
if(C.dayLabel)dayL=q('[data-u="d"] .l');
function show(on){if(shown===on)return;shown=on;
if(clock)clock.style.display=on?"":"none";
if(done)done.style.display=on?"none":"block"}
function at(ms){if(rate===ms)return;rate=ms;if(timer)clearInterval(timer);timer=setInterval(tick,ms)}
function finish(){var n=new Date();
var here=!!C.ymd&&n.getFullYear()===C.ymd[0]&&n.getMonth()+1===C.ymd[1]&&n.getDate()===C.ymd[2];
if(done)done.textContent=here?C.here:C.past;
show(false)}
function tick(){var rem=Math.floor((target-Date.now())/1000);
if(rem<=0){finish();at(60000);return}
show(true);
var trimming=C.trim,v,hide;
for(i=0;i<C.units.length;i++){u=C.units[i];v=Math.floor(rem/S[u]);rem-=v*S[u];
hide=trimming&&v===0&&i<C.units.length-1;if(!hide)trimming=false;
if(val[i])val[i].textContent=v<10?"0"+v:""+v;
if(box[i])box[i].style.display=hide?"none":"";
if(sep[i])sep[i].style.display=hide?"none":"";
if(u==="d"&&dayL)dayL.textContent=v===1?C.dayLabel[0]:C.dayLabel[1]}
at(C.units[C.units.length-1]==="s"?250:1000)}
tick();
})();</script>`;
}

function shell(theme: EmbedTheme, title: string, body: string): string {
  return [
    "<!doctype html>",
    '<html lang="en"><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="robots" content="noindex,nofollow">',
    // Without this the browser asks for /favicon.ico on every load — a 404 in the host page's
    // console, and a pointless request from every OBS source.
    '<link rel="icon" href="data:,">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${css(theme)}</style>`,
    `</head><body>${body}</body></html>`,
  ].join("");
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/** Description shown under the clock: long enough to be a sentence, short enough not to be the page. */
const NOTE_MAX = 120;

export function buildEmbedDocument(subject: EmbedSubject, theme: EmbedTheme, options?: { now?: number }): string {
  const units = clockUnits(theme);
  const target = targetInstant(subject);
  const now = options?.now ?? Date.now();
  /**
   * The server figure and the live clock disagree by up to a day's timezone offset, the same trade
   * `Countdown.tsx` documents: an all-day date is UTC midnight here (there is no viewer to ask) and
   * local midnight in the ticker, which corrects it before first paint. What is rendered below is
   * the no-JS fallback and the first frame, nothing more.
   */
  const seconds = Number.isFinite(target) ? Math.floor((target - now) / 1000) : 0;
  const values = splitRemaining(units, seconds);

  const done = theme.done.trim();
  const past = done || "This one already happened.";
  const here = done || "It's here.";
  // A finished countdown ships finished: rendering the zeroed clock and letting the ticker swap it
  // would flash `00:00:00:00` on every load, and leave a no-JS viewer with a clock that lies.
  const expired = seconds <= 0;
  const ymd = localYmd(subject);
  const onTheDay = expired && ymd !== null && new Date(now).toISOString().slice(0, 10) === subject.date.slice(0, 10);

  const inner: string[] = [];
  if (theme.title && subject.title.trim()) inner.push(`<p class="title">${escapeHtml(subject.title.trim())}</p>`);
  inner.push(renderClock(theme, units, values, expired));
  inner.push(
    `<p class="done" id="done"${expired ? ' style="display:block"' : ""}>${escapeHtml(onTheDay ? here : past)}</p>`,
  );
  if (theme.date) inner.push(`<p class="meta">${escapeHtml(longDate("en", subject.date))}</p>`);
  if (theme.note && subject.description.trim()) {
    inner.push(`<p class="note">${escapeHtml(truncate(subject.description, NOTE_MAX))}</p>`);
  }
  if (theme.brand) inner.push('<p class="brand">Until</p>');

  const card = theme.brand
    ? `<a class="card" href="${escapeHtml(safeHref(subject.href))}" target="_blank" rel="noopener">${inner.join("")}</a>`
    : `<div class="card">${inner.join("")}</div>`;

  const script = tickerScript({
    ymd,
    iso: subject.date,
    units,
    trim: theme.trim,
    // A stale "days" beside a 01 is the one caption that ages; the compact suffix and the labels-off
    // clock never do, so the ticker is only handed the word when it has to swap it.
    dayLabel: theme.labels && theme.layout !== "compact" && units[0] === "d" ? ["day", "days"] : null,
    here,
    past,
  });

  return shell(theme, `${subject.title} — countdown`, card + script);
}

/**
 * The 404 body. An iframe that outlives its event should render a legible sentence and a way back,
 * not the browser's own error page inside someone else's column.
 */
export function buildEmbedNotFoundDocument(theme: EmbedTheme, siteUrl: string): string {
  const card = [
    `<a class="card" href="${escapeHtml(safeHref(siteUrl))}" target="_blank" rel="noopener">`,
    `<p class="title">This countdown is not here any more.</p>`,
    `<p class="brand">Until</p>`,
    `</a>`,
  ].join("");
  return shell(theme, "Countdown not found — Until", card);
}
