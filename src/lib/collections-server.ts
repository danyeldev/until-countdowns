import "server-only";
import { cached, TAG_CATALOG_LISTS } from "@/lib/cache";
import { createAuthServerClient, getAuthClaims } from "@/lib/auth/server";
import { publicSupabaseEnv } from "@/lib/auth/env";
import { anonClient } from "@/lib/db/client";
import {
  getOwnCollection,
  getPublicCollection,
  listOwnCollections,
  listPublicCollections as listPublicCollectionsClient,
  listPublicCollectionsForHandle,
} from "@/lib/collections-client";
import type { CollectionDetail, CollectionSummary } from "@/lib/collections";

const listPublicCollectionsCached = cached(
  async (limit: number) => listPublicCollectionsClient(anonClient(), limit),
  ["collections", "public"],
  { tags: [TAG_CATALOG_LISTS], revalidate: 60 },
);

const listPublicCollectionsForHandleCached = cached(
  async (handle: string) => listPublicCollectionsForHandle(anonClient(), handle),
  ["collections", "public-handle"],
  { tags: [TAG_CATALOG_LISTS], revalidate: 60 },
);

const getPublicCollectionCached = cached(
  async (handle: string, slug: string) => getPublicCollection(anonClient(), handle, slug),
  ["collections", "public-detail"],
  { tags: [TAG_CATALOG_LISTS], revalidate: 60 },
);

export async function listPublicCollections(limit = 48): Promise<CollectionSummary[]> {
  if (!publicSupabaseEnv()) return [];
  try {
    return await listPublicCollectionsCached(limit);
  } catch {
    return [];
  }
}

export async function listOwnCollectionsServer(): Promise<CollectionSummary[]> {
  const claims = await getAuthClaims();
  if (!claims?.sub || typeof claims.sub !== "string") return [];
  return listOwnCollections(await createAuthServerClient(), claims.sub);
}

export async function listPublicCollectionsServer(handle: string): Promise<CollectionSummary[]> {
  if (!publicSupabaseEnv()) return [];
  return listPublicCollectionsForHandleCached(handle);
}

export async function getPublicCollectionServer(handle: string, slug: string): Promise<CollectionDetail | null> {
  if (!publicSupabaseEnv()) return null;
  return getPublicCollectionCached(handle, slug);
}

export async function getOwnCollectionServer(id: string): Promise<CollectionDetail | null> {
  const claims = await getAuthClaims();
  if (!claims?.sub || typeof claims.sub !== "string") return null;
  const collection = await getOwnCollection(await createAuthServerClient(), id);
  if (!collection || collection.owner.id !== claims.sub) return null;
  return collection;
}
