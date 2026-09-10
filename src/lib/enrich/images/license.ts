/**
 * The licence gate. Nothing reaches Supabase Storage without passing through here.
 *
 * Until re-hosts images (never hotlinks), the catalog is public and may one day carry ads, so the
 * only acceptable files are CC0 / public domain / CC BY / CC BY-SA and the handful of national
 * open-government licences Commons uses, plus NASA's media guidelines. Everything else — fair
 * use, "non-free", any NC or ND clause, an unnamed licence — is rejected with a reason that is
 * written to `enrichment_jobs.last_error`, so a skip can always be explained.
 *
 * Two independent checks have to pass for every candidate:
 *   1. **Where the bytes live** (`isRehostableFileUrl`): under `/wikipedia/commons/` on the
 *      Wikimedia upload/thumb hosts, on the NASA asset hosts, or on the Launch Library CDN.
 *      `/wikipedia/en/` is a local Wikipedia upload — that is where the fair-use posters and
 *      logos live, and `pilicense=free` is not a reliable filter for them.
 *   2. **What the metadata says** (`evaluateCommonsFile` / `evaluateNamedLicense`): a Commons
 *      `extmetadata` block, or a provider payload that names a licence from the allowlist. A
 *      free licence is not enough on its own: `Restrictions=trademarked|insignia|currency|
 *      personality` is refused too (the brief allows those inline only, and there is no inline
 *      surface), and so is a file whose required attribution names nobody ("Multiple authors").
 *
 * Verification always happens against commons.wikimedia.org: `en.wikipedia.org`'s own
 * `imageinfo` happily returns fair-use files with a working URL.
 */

import { providerLabel } from "@/lib/images";

export type LicenseVerdict = { ok: true } | { ok: false; reason: string };

/** Licences accepted, matched against `extmetadata.LicenseShortName`. */
export const LICENSE_ACCEPT_RE =
  /^(?:cc0(?:\b|-)|cc-0|public domain|pd(?:\b|-)|cc[ -]by(?:[ -]sa)?(?:[ -][0-9.]+)?(?:[ -]igo)?\b|godl-india|ogl\b|open government licen[cs]e|kogl|nasa image and media guidelines)/i;

/** Anything matching this is rejected outright, whatever else the metadata claims. */
export const LICENSE_REJECT_RE =
  /(?:fair[ -]?use|non[ -]?free|non[ -]?commercial|noncommercial|no[ -]?derivativ|\bnc\b|-nc\b|\bnd\b|-nd\b|all rights reserved|copyrighted free use with|with permission)/i;

/** Launch Library per-image licences that allow commercial re-hosting (mirrors the ll2 adapter). */
export const LL2_LICENSE_ALLOWLIST: ReadonlySet<string> = new Set([
  "cc0 1.0",
  "cc by 4.0",
  "cc by-sa 4.0",
  "cc by-sa 3.0 igo",
  "nasa image and media guidelines",
  "godl-india",
]);

/**
 * Width asked of the thumb host (`iiurlwidth`), and the width above which the 1600px rendition is
 * downloaded instead of the original. Kept here rather than in `commons.ts` so the licence gate —
 * which is what picks the URL — has no import cycle.
 */
export const PREFERRED_THUMB_WIDTH = 1600;

/**
 * `extmetadata.Restrictions` (brief §21 step 4): a file can be perfectly free of copyright and
 * still carry a trademark, insignia, currency or personality restriction. The brief allows those
 * "inline only (never hero/OG)", and Until has no inline surface, so they are refused outright.
 */
export const RESTRICTIONS_REJECT_RE = /trademark|insignia|currency|personality/i;

/**
 * Montage / composite credits. When a licence requires attribution, "Multiple authors" names
 * nobody: no reader could identify the creators from it, so the file is dropped rather than
 * published with an attribution that cannot be honoured.
 */
const UNATTRIBUTABLE_AUTHOR_RE = /^(?:multiple|various|several|different)\s+(?:authors|photographers|artists|contributors)/i;

/**
 * Personality rights are not in `extmetadata`; the file's own categories are the closest signal
 * we get. Applied only where a portrait of an identifiable person would be the wrong picture
 * (see `SENSITIVE_TITLE_RE` in `resolve.ts`), never to sports or culture rows where the person
 * *is* the subject.
 */
export const PORTRAIT_CATEGORY_RE = /portrait photographs|portraits of|official portraits|head shots/i;

export const NASA_LICENSE = "NASA Image and Media Guidelines";
export const NASA_LICENSE_URL = "https://www.nasa.gov/nasa-brand-center/images-and-media/";

const WIKIMEDIA_FILE_HOSTS: ReadonlySet<string> = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);
const NASA_FILE_HOSTS: ReadonlySet<string> = new Set(["images-assets.nasa.gov", "images-api.nasa.gov"]);
const LL2_FILE_HOSTS: ReadonlySet<string> = new Set([
  "thespacedevs-prod.nyc3.digitaloceanspaces.com",
  "thespacedevs-prod.nyc3.cdn.digitaloceanspaces.com",
]);

export type FileHostKind = "commons" | "nasa" | "launchlibrary";

/**
 * Where may we download from? Returns the host family, or null when the URL is not one we are
 * allowed to re-host (including `/wikipedia/en/` local uploads).
 */
export function fileHostKind(url: string): FileHostKind | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (WIKIMEDIA_FILE_HOSTS.has(parsed.hostname)) {
    return parsed.pathname.includes("/wikipedia/commons/") ? "commons" : null;
  }
  if (NASA_FILE_HOSTS.has(parsed.hostname)) return "nasa";
  if (LL2_FILE_HOSTS.has(parsed.hostname)) return "launchlibrary";
  return null;
}

export function isRehostableFileUrl(url: string): boolean {
  return fileHostKind(url) !== null;
}

/** `?utm_source=…&utm_campaign=…` is appended by the Action API; it never belongs in a stored URL. */
export function stripTracking(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_")) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

/**
 * Commons hides a duplicate of the author inside a `display:none` span (a microformat artefact):
 * `Unknown author<span style="display: none;">Unknown author</span>`. Dropping those first is what
 * keeps the credit line from reading "Unknown authorUnknown author".
 */
const HIDDEN_SPAN_RE = /<([a-z]+)\b[^>]*style\s*=\s*["'][^"']*display\s*:\s*none[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi;

/** Placeholders Commons uses where there is no named author; none of them is a person to credit. */
const ANONYMOUS_RE = /^(?:unknown(?: author| photographer| artist)?|anonymous|not (?:known|provided|specified)|see (?:below|file page))$/i;

/** `extmetadata` values are HTML fragments; the credit line stores plain text. */
export function stripHtml(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value
    .replace(HIDDEN_SPAN_RE, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|[a-z]+);/gi, (m, code: string) => {
      if (code.startsWith("#")) {
        const n = Number(code.slice(1));
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[code.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
  if (text.length === 0 || ANONYMOUS_RE.test(text)) return null;
  return text.slice(0, 300);
}

/**
 * Verdict on a licence name (plus the free-text usage terms when the payload has them). A missing
 * or unrecognised name is a rejection: the pipeline never assumes a file is free.
 */
export function evaluateNamedLicense(shortName: string | null | undefined, usageTerms?: string | null): LicenseVerdict {
  const name = (shortName ?? "").trim();
  if (!name) return { ok: false, reason: "no LicenseShortName" };
  if (LICENSE_REJECT_RE.test(name)) return { ok: false, reason: `rejected licence "${name}"` };
  if (usageTerms && LICENSE_REJECT_RE.test(usageTerms)) return { ok: false, reason: `rejected usage terms "${usageTerms.slice(0, 80)}"` };
  if (!LICENSE_ACCEPT_RE.test(name)) return { ok: false, reason: `licence not on the allowlist: "${name}"` };
  return { ok: true };
}

export type ExtMetadata = Record<string, { value?: unknown } | undefined>;

function meta(ext: ExtMetadata | undefined, key: string): string | null {
  const raw = ext?.[key]?.value;
  if (raw === undefined || raw === null) return null;
  const value = String(raw).trim();
  return value.length > 0 ? value : null;
}

/** One verified Commons/NASA/LL2 file, ready to download and re-host. */
export type LicensedImage = {
  /** Direct URL of the bytes (tracking params stripped). */
  fileUrl: string;
  provider: "commons" | "nasa" | "launchlibrary";
  license: string;
  licenseUrl: string | null;
  author: string | null;
  credit: string | null;
  attributionRequired: boolean;
  /** File description page / launch page / NASA details page. */
  originPage: string | null;
  width?: number;
  height?: number;
  mime?: string | null;
  /** Which step of the discovery chain produced this. */
  via: string;
};

export type CommonsImageInfo = {
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  width?: number;
  height?: number;
  mime?: string;
  extmetadata?: ExtMetadata;
};

/** Commons only ever hosts freely licensed files, but the *name* still decides what we may do. */
export const COMMONS_ACCEPTED_MIME: ReadonlySet<string> = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Full gate for a Wikimedia file: URL under `/wikipedia/commons/`, `NonFree` not set, a licence
 * on the allowlist, a raster mime type. Returns the row to persist or the reason it was dropped.
 */
export function evaluateCommonsFile(
  info: CommonsImageInfo | null | undefined,
  via: string,
  options: { rejectPortraits?: boolean } = {},
): { ok: true; image: LicensedImage } | { ok: false; reason: string } {
  if (!info) return { ok: false, reason: "no imageinfo" };
  // `iiurlwidth=1600` already produced a rendition: taking it instead of the original saves
  // downloading a 35 MB panorama to build a 1600px hero (and is what the thumb host asks for).
  const original = info.url ?? "";
  const useThumb = Boolean(info.thumburl) && (info.width ?? 0) > PREFERRED_THUMB_WIDTH;
  const fileUrl = stripTracking(useThumb ? (info.thumburl as string) : original);
  if (!fileUrl) return { ok: false, reason: "no file url" };
  if (fileHostKind(fileUrl) !== "commons") return { ok: false, reason: `not a Commons file url: ${fileUrl.slice(0, 120)}` };

  const ext = info.extmetadata;
  const nonFree = meta(ext, "NonFree");
  if (nonFree && /^(?:true|1|yes)$/i.test(nonFree)) return { ok: false, reason: "NonFree=true" };

  const verdict = evaluateNamedLicense(meta(ext, "LicenseShortName"), meta(ext, "UsageTerms"));
  if (!verdict.ok) return { ok: false, reason: verdict.reason };

  const restrictions = meta(ext, "Restrictions");
  if (restrictions && RESTRICTIONS_REJECT_RE.test(restrictions)) {
    return { ok: false, reason: `restricted: ${restrictions.slice(0, 80)}` };
  }

  const mime = info.mime ?? null;
  if (mime && !COMMONS_ACCEPTED_MIME.has(mime.toLowerCase())) return { ok: false, reason: `unsupported mime ${mime}` };

  if (options.rejectPortraits) {
    const categories = meta(ext, "Categories");
    if (categories && PORTRAIT_CATEGORY_RE.test(categories)) {
      return { ok: false, reason: "portrait of an identifiable person" };
    }
  }

  const attributionMeta = meta(ext, "AttributionRequired");
  const license = meta(ext, "LicenseShortName") as string;
  const rawArtist = stripHtml(meta(ext, "Artist"));
  const attributionRequired = attributionMeta ? /^(?:true|1|yes)$/i.test(attributionMeta) : /cc[ -]by/i.test(license);
  if (attributionRequired && rawArtist && UNATTRIBUTABLE_AUTHOR_RE.test(rawArtist)) {
    return { ok: false, reason: `attribution required but the author is "${rawArtist.slice(0, 40)}"` };
  }
  return {
    ok: true,
    image: {
      fileUrl,
      provider: "commons",
      license,
      licenseUrl: meta(ext, "LicenseUrl"),
      author: rawArtist,
      credit: stripHtml(meta(ext, "Credit")),
      // Public-domain files may say nothing; CC BY / CC BY-SA always require the credit line.
      attributionRequired,
      originPage: info.descriptionurl ? stripTracking(info.descriptionurl) : null,
      width: info.width,
      height: info.height,
      mime,
      via,
    },
  };
}

/** Gate for a Launch Library `image` object already carried on `events.image_candidate_meta`. */
export function evaluateLl2Candidate(
  url: string,
  metaJson: Record<string, unknown>,
  via: string,
): { ok: true; image: LicensedImage } | { ok: false; reason: string } {
  const fileUrl = stripTracking(url);
  if (fileHostKind(fileUrl) !== "launchlibrary") return { ok: false, reason: `not a Launch Library file url: ${fileUrl.slice(0, 120)}` };
  const license = typeof metaJson.license === "string" ? metaJson.license.trim() : "";
  if (!license) return { ok: false, reason: "no LicenseShortName" };
  if (!LL2_LICENSE_ALLOWLIST.has(license.toLowerCase())) return { ok: false, reason: `licence not on the allowlist: "${license}"` };
  const verdict = evaluateNamedLicense(license);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  const author = typeof metaJson.author === "string" ? metaJson.author.trim() : null;
  return {
    ok: true,
    image: {
      fileUrl,
      provider: "launchlibrary",
      license,
      licenseUrl: typeof metaJson.licenseUrl === "string" ? metaJson.licenseUrl : null,
      author: author || null,
      credit: author || null,
      attributionRequired: true,
      originPage: typeof metaJson.pageUrl === "string" ? metaJson.pageUrl : null,
      via,
    },
  };
}

/**
 * The single credit string stored on `images.credit` and rendered under every photo:
 * `Photo: <author> · <licence> · via <provider>`. Missing parts are dropped, never faked.
 */
export function creditLine(input: { author?: string | null; license: string; provider: string }): string {
  const parts: string[] = [];
  if (input.author) parts.push(`Photo: ${input.author}`);
  parts.push(input.license);
  parts.push(`via ${providerLabel(input.provider)}`);
  return parts.join(" · ");
}
