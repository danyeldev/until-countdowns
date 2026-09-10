/**
 * Open Graph card renderer shared by every `/og/*` route handler (Node runtime).
 *
 * One layout for the whole site: eyebrow, title in Fraunces, subtitle, the day count in Geist
 * Mono, the "Until" wordmark; a deterministic gradient from the seed when there is no image.
 * Fonts are the woff files installed as npm packages (traced into the OG routes by
 * `outputFileTracingIncludes` in next.config.ts). Satori supports flexbox only, no grid.
 */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Dated URLs (`/og/event/<slug>/<date>.png`) are immutable; undated hubs refresh hourly. */
export const CACHE_DATED = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800, immutable";
export const CACHE_UNDATED = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

const PALETTE = {
  ink: "#0c0b09",
  ink2: "#161410",
  paper: "#f3ece0",
  paperDim: "#c9c0b0",
  muted: "#8a8174",
  line: "#2c2822",
  amber: "#f0a202",
  ember: "#e85d04",
};

type FontSpec = { name: string; data: Buffer; weight: 400 | 500 | 600 | 700; style: "normal" };

let fontsPromise: Promise<FontSpec[]> | null = null;

/**
 * Read once per process; the files never change at runtime. The path segments are literals so
 * the bundler's static analysis scopes the file trace to these two files (the same paths are
 * listed in `outputFileTracingIncludes`).
 */
function loadFonts(): Promise<FontSpec[]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFile(join(process.cwd(), "node_modules", "@fontsource", "fraunces", "files", "fraunces-latin-600-normal.woff")),
      readFile(join(process.cwd(), "node_modules", "@fontsource", "geist-mono", "files", "geist-mono-latin-500-normal.woff")),
    ]).then(([serif, mono]) => [
      { name: "Fraunces", data: serif, weight: 600, style: "normal" },
      { name: "Geist Mono", data: mono, weight: 500, style: "normal" },
    ]);
    fontsPromise.catch(() => {
      fontsPromise = null;
    });
  }
  return fontsPromise;
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

/** Deterministic dark gradient: two hues from the seed, kept close to the ink so text stays legible. */
export function seedGradient(seed: string): string {
  const h = hashSeed(seed);
  const h1 = h % 360;
  const h2 = (h1 + 35 + ((h >>> 9) % 50)) % 360;
  const c1 = hslToHex(h1, 42, 14);
  const c2 = hslToHex(h2, 55, 9);
  return `linear-gradient(135deg, ${c1} 0%, ${PALETTE.ink} 52%, ${c2} 100%)`;
}

function titleSize(title: string): number {
  const n = title.length;
  if (n <= 18) return 96;
  if (n <= 30) return 80;
  if (n <= 48) return 66;
  if (n <= 70) return 54;
  return 44;
}

function clampTitle(title: string, max = 110): string {
  const clean = title.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export type OgCardInput = {
  /** Small uppercase label above the title (category, "Series", country…). */
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Whole days until the event; null/undefined hides the counter. */
  days?: number | null;
  /** Shown instead of the counter for coarse dates ("expected June 2027"). */
  expectedLabel?: string;
  /**
   * Public https URL of the stored `og.jpg` derivative (1200×630, already the card's exact size).
   * Omitted → the deterministic gradient. ShareAlike files never get here: the caller gates them
   * with `ogBackgroundUrl()`, because cropping and overlaying one makes Adapted Material.
   */
  imageUrl?: string | null;
  /**
   * Attribution for that image (CC BY requires it), already composed by the caller as
   * `Photo: <author> · <licence>` — it is drawn verbatim, never truncated, so the licence name
   * cannot be cut off the card.
   */
  imageCredit?: string | null;
  /** Any stable string: gradient hues are derived from it. */
  seed: string;
};

function Counter({ days, expectedLabel }: { days?: number | null; expectedLabel?: string }) {
  if (expectedLabel) {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: "Fraunces", fontSize: 56, color: PALETTE.amber, fontStyle: "italic" }}>
          {expectedLabel}
        </div>
      </div>
    );
  }
  if (typeof days !== "number" || !Number.isFinite(days)) return null;
  const n = Math.trunc(days);
  const value = n === 0 ? "Today" : String(Math.abs(n));
  const label = n === 0 ? "" : n === 1 ? "day to go" : n === -1 ? "day ago" : n < 0 ? "days ago" : "days to go";
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 22 }}>
      <div
        style={{
          fontFamily: n === 0 ? "Fraunces" : "Geist Mono",
          fontSize: n === 0 ? 150 : value.length > 4 ? 150 : 188,
          lineHeight: 0.9,
          color: PALETTE.amber,
          letterSpacing: n === 0 ? 0 : -6,
        }}
      >
        {value}
      </div>
      {label ? (
        <div
          style={{
            fontFamily: "Geist Mono",
            fontSize: 26,
            color: PALETTE.paperDim,
            letterSpacing: 4,
            textTransform: "uppercase",
            paddingBottom: 14,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
}

/** WhatsApp refuses to preview an og:image over 600 KB, so every card has to fit under it. */
export const OG_MAX_BYTES = 600 * 1024;

/**
 * Satori/resvg always emit a true-colour PNG, and a photographic background triples its size
 * (~880 KB for a marina at night). Quantising to a palette brings that back to ~285 KB with no
 * visible loss at card size, and keeps the response an honest `image/png`. Gradient-only cards
 * are already small and skip this entirely.
 */
const PNG_PALETTE_STEPS = [200, 128, 64];

async function compactPng(png: Buffer): Promise<Buffer> {
  if (png.byteLength <= OG_MAX_BYTES) return png;
  try {
    const { default: sharp } = await import("sharp");
    let best = png;
    for (const colors of PNG_PALETTE_STEPS) {
      const smaller = await sharp(png).png({ palette: true, colors, effort: 7 }).toBuffer();
      if (smaller.byteLength < best.byteLength) best = smaller;
      if (best.byteLength <= OG_MAX_BYTES) break;
    }
    return best;
  } catch {
    return png;
  }
}

export async function renderOgCard(input: OgCardInput, cacheControl = CACHE_UNDATED): Promise<ImageResponse> {
  const fonts = await loadFonts();
  const title = clampTitle(input.title);
  const hasImage = Boolean(input.imageUrl && /^https:\/\//.test(input.imageUrl));
  // The photo is the full card background under a scrim, so the text keeps the full width.
  const textWidth = 1080;
  const fontSize = titleSize(title);

  const response = new ImageResponse(
    (
      <div
        style={{
          width: OG_WIDTH,
          height: OG_HEIGHT,
          display: "flex",
          background: seedGradient(input.seed),
          color: PALETTE.paper,
          position: "relative",
        }}
      >
        {hasImage ? (
          <div style={{ position: "absolute", left: 0, top: 0, width: OG_WIDTH, height: OG_HEIGHT, display: "flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={input.imageUrl as string}
              alt=""
              width={OG_WIDTH}
              height={OG_HEIGHT}
              style={{ width: OG_WIDTH, height: OG_HEIGHT, objectFit: "cover" }}
            />
            {/* Two scrims: a left-to-right one so the title always has contrast, and a bottom
                one for the counter row. Anything less and a bright photo eats the text. */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: OG_WIDTH,
                height: OG_HEIGHT,
                background: `linear-gradient(100deg, ${PALETTE.ink} 4%, rgba(12,11,9,0.90) 44%, rgba(12,11,9,0.55) 100%)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                bottom: 0,
                width: OG_WIDTH,
                height: 320,
                background: `linear-gradient(0deg, ${PALETTE.ink} 0%, rgba(12,11,9,0) 100%)`,
              }}
            />
          </div>
        ) : null}

        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: OG_WIDTH,
            height: 8,
            background: `linear-gradient(90deg, ${PALETTE.amber}, ${PALETTE.ember})`,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: OG_WIDTH,
            height: OG_HEIGHT,
            padding: "56px 60px 48px 60px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", width: textWidth }}>
            <div
              style={{
                fontFamily: "Geist Mono",
                fontSize: 22,
                letterSpacing: 6,
                textTransform: "uppercase",
                color: PALETTE.amber,
              }}
            >
              {input.eyebrow}
            </div>
            <div
              style={{
                fontFamily: "Fraunces",
                fontSize,
                lineHeight: 1.05,
                marginTop: 18,
                color: PALETTE.paper,
                letterSpacing: -1,
              }}
            >
              {title}
            </div>
            {input.subtitle ? (
              <div
                style={{
                  fontFamily: "Geist Mono",
                  fontSize: 26,
                  marginTop: 22,
                  color: PALETTE.paperDim,
                }}
              >
                {input.subtitle}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              width: OG_WIDTH - 120,
            }}
          >
            <Counter days={input.days} expectedLabel={input.expectedLabel} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              {hasImage && input.imageCredit ? (
                <div style={{ fontFamily: "Geist Mono", fontSize: 15, color: PALETTE.muted, paddingBottom: 10 }}>
                  {input.imageCredit}
                </div>
              ) : null}
              <div style={{ fontFamily: "Fraunces", fontSize: 40, color: PALETTE.paper, paddingBottom: 6 }}>Until</div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": cacheControl,
      },
    },
  );
  if (!hasImage) return response;
  // Buffering is only worth it for the photo cards, which are the ones that blow the budget.
  const png = await compactPng(Buffer.from(await response.arrayBuffer()));
  // The 600 KB budget is binding, not aspirational: a busy photo that will not quantise under it
  // is dropped for the gradient rather than shipped as a card WhatsApp refuses to preview.
  if (png.byteLength > OG_MAX_BYTES) return renderOgCard({ ...input, imageUrl: null, imageCredit: null }, cacheControl);
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": cacheControl },
  }) as ImageResponse;
}

/** Whole calendar days from `fromDate` (`YYYY-MM-DD`) to an event date; timed events floor the difference. */
export function daysBetween(fromDate: string, eventDate: string, allDay: boolean): number | null {
  const from = Date.UTC(Number(fromDate.slice(0, 4)), Number(fromDate.slice(5, 7)) - 1, Number(fromDate.slice(8, 10)));
  if (!Number.isFinite(from)) return null;
  const target =
    allDay || !eventDate.includes("T")
      ? Date.UTC(Number(eventDate.slice(0, 4)), Number(eventDate.slice(5, 7)) - 1, Number(eventDate.slice(8, 10)))
      : new Date(eventDate).getTime();
  if (!Number.isFinite(target)) return null;
  return Math.floor((target - from) / 86_400_000);
}

export const OG_DATE_RE = /^(\d{4}-\d{2}-\d{2})(?:\.png)?$/;

/** Validates the `[date]` segment of a dated OG URL; returns `YYYY-MM-DD` or null. */
export function parseOgDate(segment: string): string | null {
  const m = OG_DATE_RE.exec(segment);
  if (!m) return null;
  const [y, mo, d] = m[1].split("-").map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1970 || y > 2200) return null;
  // Round-trip through the calendar so "2026-02-30" is rejected instead of rendering as 2 March
  // (every accepted URL is a cacheable variant).
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return m[1];
}

export function badRequest(message = "Bad request"): Response {
  return new Response(message, { status: 400, headers: { "Cache-Control": "public, max-age=0, s-maxage=3600" } });
}
