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

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
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
  PRESET_PALETTES,
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
} from "@/lib/embed/theme";
import type {
  EmbedFont,
  EmbedFrame,
  EmbedLayout,
  EmbedPosition,
  EmbedPreset,
  EmbedSeparator,
  EmbedTheme,
  EmbedUnits,
} from "@/lib/embed/theme";
import { fill } from "@/lib/i18n/messages/types";

const CAPTION = "text-xs uppercase tracking-[0.16em] text-muted";
const FIELD = "mt-2 w-full rounded-xl border border-line bg-ink-2 px-4 py-3 text-paper outline-none focus:border-amber/60";
const BUTTON = "rounded-full border border-line px-4 py-2 text-sm text-paper hover:border-amber/50 hover:text-amber";
/** The two options share their row evenly on a phone, and take their own width once there is space. */
const TRIGGER = `${BUTTON} flex-1 basis-40 whitespace-nowrap sm:flex-none sm:basis-auto`;
const CHIP = "rounded-full border px-3 py-1.5 text-xs";
const CHIP_ON = "border-amber/60 bg-amber/10 text-amber";
const CHIP_OFF = "border-line text-paper-dim hover:border-amber/40 hover:text-amber";

/**
 * Every word the studio shows, taken whole from `L.m.embed.studio` by the server parent.
 *
 * Only the studio is translated. What it builds — the document at `/embed/<slug>` — stays English
 * in every locale: it is dropped into somebody else’s page, it is `noindex`, and it has no locale
 * of its own to inherit, so nothing in here describes the widget’s own copy.
 */
type StudioLabels = {
  heading: string;
  controls: {
    preset: string;
    digits: string;
    type: string;
    background: string;
    transparent: string;
    font: string;
    size: string;
    layout: string;
    units: string;
    separator: string;
    frame: string;
    radius: string;
    inset: string;
    position: string;
    done: string;
    reset: string;
    colourPicker: string;
  };
  toggles: {
    unitLabels: string;
    title: string;
    date: string;
    note: string;
    wordmark: string;
    glow: string;
    trim: string;
  };
  presets: Record<EmbedPreset, string>;
  fonts: Record<EmbedFont, string>;
  layouts: Record<EmbedLayout, string>;
  separators: Record<EmbedSeparator, string>;
  frames: Record<EmbedFrame, string>;
  units: Record<EmbedUnits, string>;
  positions: Record<EmbedPosition, string>;
  copy: { code: string; url: string };
  embed: { previewTitle: string; paste: string; codeLabel: string; note: string };
  stream: { previewTitle: string; canvasNote: string; urlLabel: string; source: string; steps: string[] };
};

/** The two trigger words and the copy confirmation, from `L.m.common.actions`. */
type Actions = { embed: string; stream: string; copied: string };

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
  picker,
  value,
  disabled,
  parse,
  onChange,
}: {
  label: string;
  /** `"{label} — colour picker"`, filled here so each call site passes only the field's own name. */
  picker: string;
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
          aria-label={fill(picker, { label })}
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
          // Typing "clear" into Background disables this field mid-word; showing the draft after
          // that would leave the box contradicting the colour it is meant to be reporting.
          value={disabled ? value : (draft ?? value)}
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

export function EmbedStudio({
  slug,
  title,
  origin,
  labels,
  actions,
}: {
  slug: string;
  title: string;
  origin: string;
  labels: StudioLabels;
  actions: Actions;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("embed");
  const [embedTheme, setEmbedTheme] = useState<EmbedTheme>(DEFAULT_EMBED_THEME);
  const [streamTheme, setStreamTheme] = useState<EmbedTheme>(STREAM_EMBED_THEME);
  /** The last solid background, so the Transparent toggle is reversible without a colour hunt. */
  const [solidBg, setSolidBg] = useState(DEFAULT_EMBED_THEME.bg);
  const [copied, setCopied] = useState<string | null>(null);

  const host = useHost(origin);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasScale, setCanvasScale] = useState(0.3);

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

  /**
   * A preset is a palette, not a reset. Someone reaching for different colours has usually already
   * placed the overlay and sized it, and there is no undo here — so only the look a preset actually
   * names moves, and the remembered solid background follows it so un-ticking Transparent cannot
   * land on the dark default under light type.
   */
  function applyPreset(preset: EmbedPreset) {
    const palette = PRESET_PALETTES[preset];
    if (palette.bg !== "transparent") setSolidBg(palette.bg);
    setTheme((current) => ({ ...current, ...palette, preset }));
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

  // The overlay is authored in px against the stream canvas, so the preview iframe is that canvas
  // at full size and scaled down to fit. Sizing the iframe to the panel instead would render the
  // same 34px digits three times too large against the frame, and Size and Edge inset would lie.
  useEffect(() => {
    const frame = canvasRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      setCanvasScale(entry.contentRect.width / STREAM_CANVAS.width);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [open, stream]);

  // Relative on purpose: it resolves against whatever origin this page is served from, so the
  // preview works on localhost, on a preview deploy and in production without knowing which.
  // It carries no locale prefix either — `/embed/<slug>` is one English document in every
  // language (see `StudioLabels` above), so it never goes through `localePath()`.
  const preview = useSettled(embedPath(slug, theme), 200);
  const url = embedUrl(host, slug, theme);
  const snippet = embedIframeSnippet(url, title);
  const transparent = theme.bg === "transparent";

  return (
    <section className="mt-10 border-t border-line pt-8">
      {/* The heading only shares a line with the buttons once there is room for all three. Below
          that it sits above its own row, so the two options stay a pair instead of one landing
          hard right and the other alone underneath it. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-amber sm:mr-auto">{labels.heading}</h2>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => trigger("embed")}
            aria-expanded={open && !stream}
            // Only while this tab's panel exists: a controls relationship pointing at nothing sends
            // a screen reader's jump-to-controlled-element into a dead end.
            aria-controls={open && !stream ? panelId : undefined}
            className={`${TRIGGER} ${open && !stream ? "border-amber/60 text-amber" : ""}`}
          >
            {actions.embed}
          </button>
          <button
            type="button"
            onClick={() => trigger("stream")}
            aria-expanded={open && stream}
            aria-controls={open && stream ? panelId : undefined}
            className={`${TRIGGER} ${open && stream ? "border-amber/60 text-amber" : ""}`}
          >
            {actions.stream}
          </button>
        </div>
      </div>

      {open && (
        <div id={panelId} className="mt-6 grid gap-8 lg:grid-cols-2">
          {/* `min-w-0` on both columns: a grid child's minimum is its content, and the URL below is
              one long unbreakable string that would otherwise push the panel past a phone screen. */}
          <div className="min-w-0 space-y-6">
            <Choice
              label={labels.controls.preset}
              value={theme.preset}
              options={EMBED_PRESETS}
              labels={labels.presets}
              onChange={applyPreset}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField
                label={labels.controls.digits}
                picker={labels.controls.colourPicker}
                value={theme.accent}
                parse={parseColor}
                onChange={(v) => patch({ accent: v })}
              />
              <ColorField
                label={labels.controls.type}
                picker={labels.controls.colourPicker}
                value={theme.text}
                parse={parseColor}
                onChange={(v) => patch({ text: v })}
              />
            </div>

            <div>
              <ColorField
                label={labels.controls.background}
                picker={labels.controls.colourPicker}
                value={transparent ? solidBg : theme.bg}
                disabled={transparent}
                parse={parseBackground}
                onChange={setBackground}
              />
              <div className="mt-2">
                <Toggle
                  label={labels.controls.transparent}
                  checked={transparent}
                  onChange={(on) => setBackground(on ? "transparent" : solidBg)}
                />
              </div>
            </div>

            <Choice
              label={labels.controls.font}
              value={theme.font}
              options={EMBED_FONTS}
              labels={labels.fonts}
              onChange={(font) => patch({ font })}
            />

            <Slider
              label={labels.controls.size}
              value={theme.scale}
              min={SCALE_MIN}
              max={SCALE_MAX}
              step={5}
              suffix="%"
              onChange={(scale) => patch({ scale })}
            />

            <Choice
              label={labels.controls.layout}
              value={theme.layout}
              options={EMBED_LAYOUTS}
              labels={labels.layouts}
              onChange={(layout) => patch({ layout })}
            />

            <label className="block">
              <span className={CAPTION}>{labels.controls.units}</span>
              <select
                value={theme.units}
                onChange={(e) => patch({ units: e.target.value as EmbedUnits })}
                className={FIELD}
              >
                {EMBED_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {labels.units[unit]}
                  </option>
                ))}
              </select>
            </label>

            <Choice
              label={labels.controls.separator}
              value={theme.separator}
              options={EMBED_SEPARATORS}
              labels={labels.separators}
              onChange={(separator) => patch({ separator })}
            />

            <Choice
              label={labels.controls.frame}
              value={theme.frame}
              options={EMBED_FRAMES}
              labels={labels.frames}
              onChange={(frame) => patch({ frame })}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Slider
                label={labels.controls.radius}
                value={theme.radius}
                min={0}
                max={RADIUS_MAX}
                suffix="px"
                onChange={(radius) => patch({ radius })}
              />
              <Slider
                label={labels.controls.inset}
                value={theme.padding}
                min={0}
                max={PADDING_MAX}
                suffix="px"
                onChange={(padding) => patch({ padding })}
              />
            </div>

            <div role="group" aria-label={labels.controls.position}>
              <span className={CAPTION}>{labels.controls.position}</span>
              <div className="mt-2 grid w-max grid-cols-3 gap-1.5">
                {EMBED_POSITIONS.map((position) => (
                  <button
                    key={position}
                    type="button"
                    title={labels.positions[position]}
                    aria-label={labels.positions[position]}
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
              <Toggle
                label={labels.toggles.unitLabels}
                checked={theme.labels}
                onChange={(on) => patch({ labels: on })}
              />
              <Toggle label={labels.toggles.title} checked={theme.title} onChange={(v) => patch({ title: v })} />
              <Toggle label={labels.toggles.date} checked={theme.date} onChange={(date) => patch({ date })} />
              <Toggle label={labels.toggles.note} checked={theme.note} onChange={(note) => patch({ note })} />
              <Toggle label={labels.toggles.wordmark} checked={theme.brand} onChange={(brand) => patch({ brand })} />
              <Toggle label={labels.toggles.glow} checked={theme.glow} onChange={(glow) => patch({ glow })} />
              <Toggle label={labels.toggles.trim} checked={theme.trim} onChange={(trim) => patch({ trim })} />
            </div>

            <label className="block">
              <span className={CAPTION}>{labels.controls.done}</span>
              <input
                type="text"
                maxLength={DONE_MAX}
                // The widget's own default, quoted verbatim: the document stays English whatever
                // language the studio is read in, so translating the sample would misreport it.
                placeholder="It's here."
                value={theme.done}
                onChange={(e) => patch({ done: e.target.value })}
                className={FIELD}
              />
            </label>

            <button type="button" onClick={() => setTheme(startingTheme)} className={BUTTON}>
              {labels.controls.reset}
            </button>
          </div>

          {/* The controls run long; the preview and the thing to copy stay in view beside them. */}
          <div className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
            {stream ? (
              <>
                <div
                  ref={canvasRef}
                  className="relative aspect-video w-full overflow-hidden rounded-2xl border border-line"
                  style={CHECKERBOARD}
                >
                  <div
                    className="absolute left-0 top-0 origin-top-left"
                    style={{
                      width: STREAM_CANVAS.width,
                      height: STREAM_CANVAS.height,
                      transform: `scale(${canvasScale})`,
                    }}
                  >
                    {/* Keyed on the src so a change swaps the element out — navigating a live iframe
                        would otherwise push entries into this page's own history. */}
                    <iframe
                      key={preview}
                      src={preview}
                      title={labels.stream.previewTitle}
                      className="h-full w-full border-0"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted">
                  {fill(labels.stream.canvasNote, { width: STREAM_CANVAS.width, height: STREAM_CANVAS.height })}
                </p>

                <div>
                  <span className={CAPTION}>{labels.stream.urlLabel}</span>
                  <pre className="mt-2 whitespace-pre-wrap break-all rounded-xl border border-line bg-ink-2 p-4 font-mono text-xs text-paper-dim">
                    {url}
                  </pre>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => copy("url", url)} className={BUTTON}>
                    {copied === "url" ? actions.copied : labels.copy.url}
                  </button>
                  <span className="text-xs text-muted">
                    {fill(labels.stream.source, { width: STREAM_CANVAS.width, height: STREAM_CANVAS.height })}
                  </span>
                </div>
                <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
                  {labels.stream.steps.map((step, i) => (
                    <li key={i}>
                      {fill(step, { width: STREAM_CANVAS.width, height: STREAM_CANVAS.height })}
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <>
                <div className="overflow-hidden rounded-2xl border border-line">
                  {/* See the stream preview above for why this is keyed. */}
                  <iframe
                    key={preview}
                    src={preview}
                    title={labels.embed.previewTitle}
                    className="block w-full border-0"
                    style={{ height: EMBED_BOX.height }}
                  />
                </div>

                <div>
                  <span className={CAPTION}>{labels.embed.paste}</span>
                  <textarea
                    readOnly
                    rows={3}
                    value={snippet}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={labels.embed.codeLabel}
                    className="mt-2 w-full rounded-xl border border-line bg-ink-2 px-4 py-3 font-mono text-xs text-paper-dim outline-none focus:border-amber/60"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => copy("code", snippet)} className={BUTTON}>
                    {copied === "code" ? actions.copied : labels.copy.code}
                  </button>
                  <button type="button" onClick={() => copy("url", url)} className={BUTTON}>
                    {copied === "url" ? actions.copied : labels.copy.url}
                  </button>
                </div>
                <p className="text-xs text-muted">{fill(labels.embed.note, { height: EMBED_BOX.height })}</p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
