"use client";

/**
 * The customiser behind the two new share options — "Embed on your site" and "Add to your stream".
 *
 * Both are the same document at `/embed/<slug>`, so this is one editor over a single `EmbedTheme`
 * with two starting points (`DEFAULT_EMBED_THEME` / `STREAM_EMBED_THEME`) and two ways of handing
 * the result over: an `<iframe>` snippet, or a browser-source URL. Each tab keeps its own theme —
 * a stream overlay and a sidebar widget are never tuned the same way.
 *
 * The preview is the real embed in a real iframe rather than a second implementation of the clock:
 * what a person is looking at is exactly what they are about to paste.
 */

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import {
  DEFAULT_EMBED_THEME,
  DONE_MAX,
  EMBED_BOX,
  EMBED_FONTS,
  EMBED_FRAMES,
  EMBED_LAYOUTS,
  EMBED_POSITIONS,
  EMBED_PRESETS,
  EMBED_SEPARATORS,
  EMBED_UNITS,
  PADDING_MAX,
  PRESET_LABELS,
  RADIUS_MAX,
  SCALE_MAX,
  SCALE_MIN,
  STREAM_CANVAS,
  STREAM_EMBED_THEME,
  embedIframeSnippet,
  embedPath,
  embedUrl,
  parseBackground,
  parseColor,
  presetTheme,
} from "@/lib/embed/theme";
import type {
  EmbedFont,
  EmbedFrame,
  EmbedLayout,
  EmbedPosition,
  EmbedSeparator,
  EmbedTheme,
  EmbedUnits,
} from "@/lib/embed/theme";

const CAPTION = "text-xs uppercase tracking-[0.16em] text-muted";
const FIELD = "mt-2 w-full rounded-xl border border-line bg-ink-2 px-4 py-3 text-paper outline-none focus:border-amber/60";
const BUTTON = "rounded-full border border-line px-4 py-2 text-sm text-paper hover:border-amber/50 hover:text-amber";
const CHIP = "rounded-full border px-3 py-1.5 text-xs";
const CHIP_ON = "border-amber/60 bg-amber/10 text-amber";
const CHIP_OFF = "border-line text-paper-dim hover:border-amber/40 hover:text-amber";

const FONT_LABELS: Record<EmbedFont, string> = { serif: "Serif", sans: "Sans", mono: "Mono" };
const LAYOUT_LABELS: Record<EmbedLayout, string> = {
  row: "Row",
  stack: "Stacked",
  compact: "Compact",
  big: "One big number",
};
const SEPARATOR_LABELS: Record<EmbedSeparator, string> = {
  colon: "Colon",
  dot: "Dot",
  space: "Space",
  none: "None",
};
const FRAME_LABELS: Record<EmbedFrame, string> = { card: "Card", outline: "Outline", none: "None" };
const UNIT_LABELS: Record<EmbedUnits, string> = {
  dhms: "Days · hours · minutes · seconds",
  dhm: "Days · hours · minutes",
  dh: "Days · hours",
  d: "Days",
  hms: "Hours · minutes · seconds",
  hm: "Hours · minutes",
  ms: "Minutes · seconds",
};

/** "top-left" → "Top left". The picker is a grid, so the words only ever reach a screen reader. */
function positionLabel(position: EmbedPosition): string {
  const words = position.replace("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Each cell parks its dot where the clock will sit, so the picker is a map rather than a legend. */
const POSITION_ALIGN: Record<EmbedPosition, string> = {
  "top-left": "items-start justify-start",
  top: "items-start justify-center",
  "top-right": "items-start justify-end",
  left: "items-center justify-start",
  center: "items-center justify-center",
  right: "items-center justify-end",
  "bottom-left": "items-end justify-start",
  bottom: "items-end justify-center",
  "bottom-right": "items-end justify-end",
};

/** Behind the stream preview: a streamer has to SEE that the background is keyed out, not read it. */
const CHECKERBOARD: CSSProperties = {
  backgroundColor: "#1b1917",
  backgroundImage:
    "linear-gradient(45deg, #2c2822 25%, transparent 25%), linear-gradient(-45deg, #2c2822 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2c2822 75%), linear-gradient(-45deg, transparent 75%, #2c2822 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
};

/**
 * An iframe reloads on every `src` change, so dragging a slider would restart the embed document on
 * each frame. Let the value settle first; the controls themselves stay live.
 */
/** Nothing to subscribe to: an origin cannot change without leaving the page. */
const noSubscribe = () => () => {};

/**
 * The origin to write into the snippet a person copies. `fallback` is the deployed site as the
 * server knows it; once hydrated the browser's own origin is the honest one — a snippet copied on
 * localhost has to point at localhost or it renders nothing. The swap belongs to the hydrated
 * render rather than to an effect, which is what `useSyncExternalStore` is for (see use-now.ts).
 */
function useHost(fallback: string): string {
  return useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => fallback,
  );
}

function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

function Choice<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (next: T) => void;
}) {
  return (
    <div role="group" aria-label={label}>
      <span className={CAPTION}>{label}</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            onClick={() => onChange(option)}
            className={`${CHIP} ${option === value ? CHIP_ON : CHIP_OFF}`}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block">
      <span className={CAPTION}>
        {label} <span className="text-paper-dim">{`${value}${suffix}`}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-amber"
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-paper-dim">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-line bg-ink-2 accent-amber"
      />
      {label}
    </label>
  );
}

/**
 * A swatch and a text field over the same value, so a brand hex can be pasted rather than hunted
 * for in the OS picker. The typed draft survives until blur — committing only what parses would
 * otherwise rewrite the field halfway through "#f0a202".
 */
function ColorField({
  label,
  value,
  disabled,
  parse,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  parse: (raw: string) => string | null;
  onChange: (next: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const swatch = value.startsWith("#") ? value : "#000000";

  return (
    <div>
      <label className={CAPTION} htmlFor={id}>
        {label}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} — colour picker`}
          value={swatch}
          disabled={disabled}
          onChange={(e) => {
            setDraft(null);
            onChange(e.target.value);
          }}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-ink-2 p-1 disabled:opacity-40"
        />
        <input
          id={id}
          type="text"
          inputMode="text"
          spellCheck={false}
          placeholder="#rrggbb"
          value={draft ?? value}
          disabled={disabled}
          onChange={(e) => {
            setDraft(e.target.value);
            const parsed = parse(e.target.value);
            if (parsed) onChange(parsed);
          }}
          onBlur={() => setDraft(null)}
          className="w-full rounded-xl border border-line bg-ink-2 px-3 py-2 font-mono text-sm text-paper outline-none placeholder:text-muted focus:border-amber/60 disabled:opacity-40"
        />
      </div>
    </div>
  );
}

type Tab = "embed" | "stream";

export function EmbedStudio({ slug, title, origin }: { slug: string; title: string; origin: string }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("embed");
  const [embedTheme, setEmbedTheme] = useState<EmbedTheme>(DEFAULT_EMBED_THEME);
  const [streamTheme, setStreamTheme] = useState<EmbedTheme>(STREAM_EMBED_THEME);
  /** The last solid background, so the Transparent toggle is reversible without a colour hunt. */
  const [solidBg, setSolidBg] = useState(DEFAULT_EMBED_THEME.bg);
  const [copied, setCopied] = useState<string | null>(null);

  const host = useHost(origin);

  const stream = tab === "stream";
  const theme = stream ? streamTheme : embedTheme;
  const setTheme = stream ? setStreamTheme : setEmbedTheme;
  const startingTheme = stream ? STREAM_EMBED_THEME : DEFAULT_EMBED_THEME;

  function patch(next: Partial<EmbedTheme>) {
    setTheme((current) => ({ ...current, ...next }));
  }

  function setBackground(next: string) {
    if (next !== "transparent") setSolidBg(next);
    patch({ bg: next });
  }

  function trigger(next: Tab) {
    if (open && tab === next) {
      setOpen(false);
      return;
    }
    setTab(next);
    setOpen(true);
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Denied permission, or an insecure origin — the text is on screen to select by hand.
      return;
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  }

  // Relative on purpose: it resolves against whatever origin this page is served from, so the
  // preview works on localhost, on a preview deploy and in production without knowing which.
  const preview = useSettled(embedPath(slug, theme), 200);
  const url = embedUrl(host, slug, theme);
  const snippet = embedIframeSnippet(url, title);
  const transparent = theme.bg === "transparent";

  return (
    <section className="mt-10 border-t border-line pt-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-[11px] uppercase tracking-[0.22em] text-amber">Take it with you</h2>
        <button
          type="button"
          onClick={() => trigger("embed")}
          aria-expanded={open && !stream}
          aria-controls={panelId}
          className={`${BUTTON} ${open && !stream ? "border-amber/60 text-amber" : ""}`}
        >
          Embed on your site
        </button>
        <button
          type="button"
          onClick={() => trigger("stream")}
          aria-expanded={open && stream}
          aria-controls={panelId}
          className={`${BUTTON} ${open && stream ? "border-amber/60 text-amber" : ""}`}
        >
          Add to your stream
        </button>
      </div>

      {open && (
        <div id={panelId} className="mt-6 grid gap-8 lg:grid-cols-2">
          {/* `min-w-0` on both columns: a grid child's minimum is its content, and the URL below is
              one long unbreakable string that would otherwise push the panel past a phone screen. */}
          <div className="min-w-0 space-y-6">
            <Choice
              label="Preset"
              value={theme.preset}
              options={EMBED_PRESETS}
              labels={PRESET_LABELS}
              onChange={(preset) => setTheme(presetTheme(preset))}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField label="Digits" value={theme.accent} parse={parseColor} onChange={(v) => patch({ accent: v })} />
              <ColorField label="Type" value={theme.text} parse={parseColor} onChange={(v) => patch({ text: v })} />
            </div>

            <div>
              <ColorField
                label="Background"
                value={transparent ? solidBg : theme.bg}
                disabled={transparent}
                parse={parseBackground}
                onChange={setBackground}
              />
              <div className="mt-2">
                <Toggle
                  label="Transparent — lets the scene or the page through"
                  checked={transparent}
                  onChange={(on) => setBackground(on ? "transparent" : solidBg)}
                />
              </div>
            </div>

            <Choice label="Font" value={theme.font} options={EMBED_FONTS} labels={FONT_LABELS} onChange={(font) => patch({ font })} />

            <Slider
              label="Size"
              value={theme.scale}
              min={SCALE_MIN}
              max={SCALE_MAX}
              step={5}
              suffix="%"
              onChange={(scale) => patch({ scale })}
            />

            <Choice
              label="Layout"
              value={theme.layout}
              options={EMBED_LAYOUTS}
              labels={LAYOUT_LABELS}
              onChange={(layout) => patch({ layout })}
            />

            <label className="block">
              <span className={CAPTION}>Units</span>
              <select
                value={theme.units}
                onChange={(e) => patch({ units: e.target.value as EmbedUnits })}
                className={FIELD}
              >
                {EMBED_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {UNIT_LABELS[unit]}
                  </option>
                ))}
              </select>
            </label>

            <Choice
              label="Separator"
              value={theme.separator}
              options={EMBED_SEPARATORS}
              labels={SEPARATOR_LABELS}
              onChange={(separator) => patch({ separator })}
            />

            <Choice
              label="Frame"
              value={theme.frame}
              options={EMBED_FRAMES}
              labels={FRAME_LABELS}
              onChange={(frame) => patch({ frame })}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Slider
                label="Corner radius"
                value={theme.radius}
                min={0}
                max={RADIUS_MAX}
                suffix="px"
                onChange={(radius) => patch({ radius })}
              />
              <Slider
                label="Edge inset"
                value={theme.padding}
                min={0}
                max={PADDING_MAX}
                suffix="px"
                onChange={(padding) => patch({ padding })}
              />
            </div>

            <div role="group" aria-label="Position">
              <span className={CAPTION}>Position</span>
              <div className="mt-2 grid w-max grid-cols-3 gap-1.5">
                {EMBED_POSITIONS.map((position) => (
                  <button
                    key={position}
                    type="button"
                    title={positionLabel(position)}
                    aria-label={positionLabel(position)}
                    aria-pressed={position === theme.position}
                    onClick={() => patch({ position })}
                    className={`flex h-10 w-10 rounded-lg border p-1.5 ${POSITION_ALIGN[position]} ${
                      position === theme.position ? "border-amber/60 bg-amber/10" : "border-line hover:border-amber/40"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${position === theme.position ? "bg-amber" : "bg-muted"}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Toggle label="Unit labels" checked={theme.labels} onChange={(labels) => patch({ labels })} />
              <Toggle label="Title" checked={theme.title} onChange={(v) => patch({ title: v })} />
              <Toggle label="Date" checked={theme.date} onChange={(date) => patch({ date })} />
              <Toggle label="Note" checked={theme.note} onChange={(note) => patch({ note })} />
              <Toggle label="Wordmark" checked={theme.brand} onChange={(brand) => patch({ brand })} />
              <Toggle label="Glow" checked={theme.glow} onChange={(glow) => patch({ glow })} />
              <Toggle label="Trim leading zeros" checked={theme.trim} onChange={(trim) => patch({ trim })} />
            </div>

            <label className="block">
              <span className={CAPTION}>Finished message</span>
              <input
                type="text"
                maxLength={DONE_MAX}
                placeholder="It's here."
                value={theme.done}
                onChange={(e) => patch({ done: e.target.value })}
                className={FIELD}
              />
            </label>

            <button type="button" onClick={() => setTheme(startingTheme)} className={BUTTON}>
              Reset
            </button>
          </div>

          {/* The controls run long; the preview and the thing to copy stay in view beside them. */}
          <div className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
            {stream ? (
              <>
                <div
                  className="relative aspect-video w-full overflow-hidden rounded-2xl border border-line"
                  style={CHECKERBOARD}
                >
                  {/* Keyed on the src so a change swaps the element out — navigating a live iframe
                      would otherwise push entries into this page's own history. */}
                  <iframe
                    key={preview}
                    src={preview}
                    title="Stream overlay preview"
                    className="absolute inset-0 h-full w-full border-0"
                  />
                </div>
                <p className="text-xs text-muted">
                  The {STREAM_CANVAS.width} × {STREAM_CANVAS.height} canvas, scaled down — the chequerboard is what OBS
                  keys out.
                </p>

                <div>
                  <span className={CAPTION}>Browser source URL</span>
                  <pre className="mt-2 whitespace-pre-wrap break-all rounded-xl border border-line bg-ink-2 p-4 font-mono text-xs text-paper-dim">
                    {url}
                  </pre>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => copy("url", url)} className={BUTTON}>
                    {copied === "url" ? "Copied" : "Copy URL"}
                  </button>
                  <span className="text-xs text-muted">
                    Browser source · {STREAM_CANVAS.width} × {STREAM_CANVAS.height}
                  </span>
                </div>
                <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
                  <li>In OBS or Streamlabs, add a Browser source.</li>
                  <li>Paste the URL above.</li>
                  <li>
                    Set the size to {STREAM_CANVAS.width} × {STREAM_CANVAS.height} — the canvas the position is measured
                    against.
                  </li>
                  <li>Leave the background transparent; the overlay brings its own.</li>
                  <li>Tick &ldquo;Refresh browser when scene becomes active&rdquo; so the clock starts fresh.</li>
                </ol>
              </>
            ) : (
              <>
                <div className="overflow-hidden rounded-2xl border border-line">
                  {/* See the stream preview above for why this is keyed. */}
                  <iframe
                    key={preview}
                    src={preview}
                    title="Embed preview"
                    className="block w-full border-0"
                    style={{ height: EMBED_BOX.height }}
                  />
                </div>

                <div>
                  <span className={CAPTION}>Paste this into your page</span>
                  <textarea
                    readOnly
                    rows={3}
                    value={snippet}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Embed code"
                    className="mt-2 w-full rounded-xl border border-line bg-ink-2 px-4 py-3 font-mono text-xs text-paper-dim outline-none focus:border-amber/60"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => copy("code", snippet)} className={BUTTON}>
                    {copied === "code" ? "Copied" : "Copy code"}
                  </button>
                  <button type="button" onClick={() => copy("url", url)} className={BUTTON}>
                    {copied === "url" ? "Copied" : "Copy URL"}
                  </button>
                </div>
                <p className="text-xs text-muted">
                  It drops in at full width and {EMBED_BOX.height}px tall. WordPress, Ghost and Notion take the
                  countdown&rsquo;s own link instead — paste that and they find this embed themselves.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
