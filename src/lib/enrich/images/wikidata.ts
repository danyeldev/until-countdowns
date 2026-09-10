/**
 * Step 2 of the discovery chain: Wikidata claims, 50 entities per `wbgetentities` call.
 *
 * Order (brief §21): `P18` (image) → `P154` (logo — off by default: a trademarked mark is fine
 * inline but never as a hero or an OG background, and Until has no inline surface) → the
 * venue's `P18` (`P276` → `P18`) → the
 * country's flag (`P17` → `P41`, a reasonable last visual resort for elections and national
 * days). Every filename still has to survive the Commons `imageinfo` gate afterwards.
 */
import type { EnrichContext } from "../context";

export const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
export const ENTITY_BATCH = 50;

/** `.pdf` and `.svg` P18 values exist; only raster files are re-hosted. */
const RASTER_RE = /\.(?:jpe?g|png|webp)$/i;

type Snak = { mainsnak?: { datavalue?: { value?: unknown; type?: string }; snaktype?: string } };
type EntityClaims = Record<string, Snak[] | undefined>;
type WbEntity = { id?: string; claims?: EntityClaims; sitelinks?: Record<string, { title?: string }> };
type WbResponse = { entities?: Record<string, WbEntity> };

export type EntityInfo = {
  qid: string;
  enwiki: string | null;
  image: string | null;
  logo: string | null;
  flag: string | null;
  venueQid: string | null;
  countryQid: string | null;
};

function stringClaim(claims: EntityClaims | undefined, property: string): string | null {
  for (const snak of claims?.[property] ?? []) {
    if (snak.mainsnak?.snaktype !== "value") continue;
    const value = snak.mainsnak?.datavalue?.value;
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function entityClaim(claims: EntityClaims | undefined, property: string): string | null {
  for (const snak of claims?.[property] ?? []) {
    if (snak.mainsnak?.snaktype !== "value") continue;
    const value = snak.mainsnak?.datavalue?.value;
    if (value && typeof value === "object" && "id" in value) {
      const id = String((value as { id: unknown }).id);
      if (/^Q[1-9][0-9]*$/.test(id)) return id;
    }
  }
  return null;
}

function rasterOrNull(file: string | null): string | null {
  return file && RASTER_RE.test(file) ? file : null;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function parseEntities(data: WbResponse): Map<string, EntityInfo> {
  const out = new Map<string, EntityInfo>();
  for (const [qid, entity] of Object.entries(data.entities ?? {})) {
    if (!/^Q[1-9][0-9]*$/.test(qid)) continue;
    out.set(qid, {
      qid,
      enwiki: entity.sitelinks?.enwiki?.title ?? null,
      image: rasterOrNull(stringClaim(entity.claims, "P18")),
      logo: rasterOrNull(stringClaim(entity.claims, "P154")),
      flag: rasterOrNull(stringClaim(entity.claims, "P41")),
      venueQid: entityClaim(entity.claims, "P276"),
      countryQid: entityClaim(entity.claims, "P17"),
    });
  }
  return out;
}

export async function fetchEntities(ctx: EnrichContext, qids: readonly string[]): Promise<Map<string, EntityInfo>> {
  const out = new Map<string, EntityInfo>();
  const unique = [...new Set(qids)].filter((q) => /^Q[1-9][0-9]*$/.test(q));
  for (const batch of chunk(unique, ENTITY_BATCH)) {
    if (ctx.budget.remainingMs() < 5_000) break;
    const url =
      `${WIKIDATA_API}?action=wbgetentities&format=json&props=claims%7Csitelinks&languages=en` +
      `&ids=${encodeURIComponent(batch.join("|"))}`;
    const data = await ctx.http.fetchJson<WbResponse>(url);
    for (const [qid, info] of parseEntities(data)) out.set(qid, info);
  }
  return out;
}

export type WikidataFileCandidate = { file: string; via: "wikidata-p18" | "wikidata-logo" | "wikidata-venue" | "wikidata-flag" };

/**
 * Ordered file candidates for one entity. `secondary` holds the venue/country entities already
 * fetched by the caller (they arrive in a second `wbgetentities` round).
 *
 * `allowLogo` gates `P154`, and **no caller passes it**. The brief allows a logo "only for small
 * inline use, never hero/OG" (Olympic rings, FIFA marks, `Restrictions=trademarked`), and Until
 * has no inline-logo surface: everything stored becomes a hero. The step stays here, switched
 * off, for the day that surface exists.
 */
export function fileCandidates(
  info: EntityInfo | undefined,
  secondary: Map<string, EntityInfo>,
  options: { allowLogo?: boolean; allowFlag?: boolean } = {},
): WikidataFileCandidate[] {
  if (!info) return [];
  const out: WikidataFileCandidate[] = [];
  if (info.image) out.push({ file: info.image, via: "wikidata-p18" });
  if (options.allowLogo && info.logo) out.push({ file: info.logo, via: "wikidata-logo" });
  const venue = info.venueQid ? secondary.get(info.venueQid) : undefined;
  if (venue?.image) out.push({ file: venue.image, via: "wikidata-venue" });
  if (options.allowFlag) {
    const country = info.countryQid ? secondary.get(info.countryQid) : undefined;
    if (country?.flag) out.push({ file: country.flag, via: "wikidata-flag" });
  }
  return out;
}
