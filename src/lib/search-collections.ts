import { collectionHref, type CollectionSummary } from "./collections";
import {
  FEATURED_COLLECTIONS,
  featuredCollectionHref,
} from "./featured-collections-meta";

export type CollectionSearchHit = {
  id: string;
  href: string;
  title: string;
  description: string;
  byline: string;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalize(value).split(" ").filter((token) => token.length >= 2);
}

function hasWord(hay: string, word: string): boolean {
  return tokens(hay).includes(word);
}

function scoreHaystack(query: string, title: string, extra: string[]): number {
  const needle = normalize(query);
  if (needle.length < 2) return 0;
  const titleNorm = normalize(title);
  const extraNorm = normalize(extra.join(" "));
  let score = 0;
  if (titleNorm.includes(needle)) score += 8;
  if (extraNorm.includes(needle)) score += 4;
  for (const token of tokens(query)) {
    if (hasWord(titleNorm, token)) score += 3;
    else if (hasWord(extraNorm, token)) score += 1;
  }
  return score;
}

export function matchFeaturedCollections(query: string): CollectionSearchHit[] {
  return FEATURED_COLLECTIONS.flatMap((collection) => {
    const score = scoreHaystack(query, collection.title, [
      collection.description,
      collection.slug.replace(/-/g, " "),
      ...collection.keywords,
    ]);
    if (score <= 0) return [];
    return [
      {
        score,
        hit: {
          id: `featured-${collection.slug}`,
          href: featuredCollectionHref(collection.slug),
          title: collection.title,
          description: collection.description,
          byline: "Until's lists",
        },
      },
    ];
  })
    .sort((left, right) => right.score - left.score || left.hit.title.localeCompare(right.hit.title))
    .map((item) => item.hit);
}

export function matchPublicCollections(
  query: string,
  collections: CollectionSummary[],
): CollectionSearchHit[] {
  return collections.flatMap((collection) => {
    const score = scoreHaystack(query, collection.title, [
      collection.description,
      collection.slug.replace(/-/g, " "),
      collection.owner.handle,
      collection.owner.name,
    ]);
    if (score <= 0) return [];
    return [
      {
        score,
        hit: {
          id: collection.id,
          href: collectionHref(collection.owner.handle, collection.slug),
          title: collection.title,
          description: collection.description,
          byline: `@${collection.owner.handle}`,
        },
      },
    ];
  })
    .sort((left, right) => right.score - left.score || left.hit.title.localeCompare(right.hit.title))
    .map((item) => item.hit);
}

export function mergeCollectionHits(
  featured: CollectionSearchHit[],
  published: CollectionSearchHit[],
  limit: number,
): CollectionSearchHit[] {
  const seen = new Set<string>();
  const out: CollectionSearchHit[] = [];
  for (const hit of [...featured, ...published]) {
    if (seen.has(hit.href)) continue;
    seen.add(hit.href);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}
