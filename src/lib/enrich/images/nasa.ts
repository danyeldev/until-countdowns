/**
 * Step 5: the NASA Image and Video Library (space / astronomy / science rows only).
 *
 * `images-api.nasa.gov` needs no key and is a different host from `api.nasa.gov` (whose DEMO_KEY
 * limits do not apply here); the documented rate limit is unknown, so calls are spaced a second
 * apart. The payload has **no rights field**, and the library does carry third-party items
 * ("copyright Rick Sternbach", "for government educational use only"), so the description is
 * screened for copyright language and the title/keywords for logos and mission patches before an
 * asset is accepted under NASA's media guidelines.
 */
import type { EnrichContext } from "../context";
import { NASA_INTERVAL_MS } from "../context";
import { type LicensedImage, NASA_LICENSE, NASA_LICENSE_URL, stripTracking } from "./license";

export const NASA_SEARCH = "https://images-api.nasa.gov/search";
export const NASA_ASSET = "https://images-api.nasa.gov/asset/";

/** Third-party or restricted items: their description says so in plain English. */
export const NASA_RIGHTS_RE = /copyright|©|\(c\)\s*\d{4}|all rights reserved|educational use only|courtesy of (?!nasa)/i;
/** Logos, insignia and mission patches are not illustrations of an event. */
export const NASA_BADGE_RE = /\blogo\b|insignia|meatball|\bworm\b|emblem|identifier|\bpatch\b|decal/i;

type NasaItem = {
  href?: string;
  data?: Array<{
    nasa_id?: string;
    title?: string;
    description?: string;
    keywords?: string[];
    media_type?: string;
    center?: string;
    secondary_creator?: string;
    photographer?: string;
  }>;
  links?: Array<{ href?: string; render?: string }>;
};
type NasaSearch = { collection?: { items?: NasaItem[] } };
type NasaAsset = { collection?: { items?: Array<{ href?: string }> } };

export type NasaCandidate = { nasaId: string; title: string; credit: string; assetHref: string };

/** Filter one search payload down to usable items (pure, so the tests can drive it). */
export function acceptableItems(data: NasaSearch): NasaCandidate[] {
  const out: NasaCandidate[] = [];
  for (const item of data.collection?.items ?? []) {
    const d = item.data?.[0];
    if (!d?.nasa_id || d.media_type !== "image") continue;
    const description = d.description ?? "";
    if (NASA_RIGHTS_RE.test(description)) continue;
    const haystack = `${d.title ?? ""} ${(d.keywords ?? []).join(" ")}`;
    if (NASA_BADGE_RE.test(haystack)) continue;
    if (!item.href) continue;
    const creditParts = ["NASA"];
    const extra = d.secondary_creator ?? d.photographer ?? d.center;
    if (extra && !/^nasa$/i.test(extra.trim())) creditParts.push(extra.trim());
    out.push({ nasaId: d.nasa_id, title: d.title ?? d.nasa_id, credit: creditParts.join("/"), assetHref: item.href });
  }
  return out;
}

/** From an asset manifest, the largest usable rendition (`~orig` beats `~large` beats `~medium`). */
export function pickAsset(data: NasaAsset): string | null {
  const hrefs = (data.collection?.items ?? [])
    .map((i) => i.href ?? "")
    .filter((h) => /^https:\/\//.test(h) && /\.(?:jpe?g|png|webp)$/i.test(h));
  for (const suffix of ["~orig.", "~large.", "~medium."]) {
    const hit = hrefs.find((h) => h.includes(suffix));
    if (hit) return hit;
  }
  return hrefs[0] ?? null;
}

export async function findNasaImage(ctx: EnrichContext, query: string): Promise<LicensedImage | null> {
  const search = await ctx.http.fetchJson<NasaSearch>(
    `${NASA_SEARCH}?q=${encodeURIComponent(query)}&media_type=image&page_size=10`,
    { minIntervalMs: NASA_INTERVAL_MS },
  );
  const candidates = acceptableItems(search);
  for (const candidate of candidates.slice(0, 3)) {
    if (ctx.budget.remainingMs() < 5_000) break;
    const manifest = await ctx.http.fetchJson<NasaAsset>(candidate.assetHref.replace(/^http:/, "https:"), {
      minIntervalMs: NASA_INTERVAL_MS,
    });
    const file = pickAsset(manifest);
    if (!file) continue;
    return {
      fileUrl: stripTracking(file),
      provider: "nasa",
      license: NASA_LICENSE,
      licenseUrl: NASA_LICENSE_URL,
      author: candidate.credit,
      credit: candidate.credit,
      attributionRequired: true,
      originPage: `https://images.nasa.gov/details/${encodeURIComponent(candidate.nasaId)}`,
      via: "nasa",
    };
  }
  return null;
}
