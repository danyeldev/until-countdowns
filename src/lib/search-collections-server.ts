import "server-only";
import { listPublicCollections } from "./collections-server";
import {
  matchFeaturedCollections,
  matchPublicCollections,
  mergeCollectionHits,
  type CollectionSearchHit,
} from "./search-collections";

export async function searchCollections(query: string, limit = 6): Promise<CollectionSearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const published = await listPublicCollections(48);
  return mergeCollectionHits(
    matchFeaturedCollections(trimmed),
    matchPublicCollections(trimmed, published),
    limit,
  );
}
