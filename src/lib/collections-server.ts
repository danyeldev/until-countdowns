import "server-only";
import { publicSupabaseEnv } from "@/lib/auth/env";
import { createAuthServerClient, getAuthClaims } from "@/lib/auth/server";
import {
  getOwnCollection,
  getPublicCollection,
  listOwnCollections,
  listPublicCollections as listPublicCollectionsClient,
  listPublicCollectionsForHandle,
} from "@/lib/collections-client";
import type { CollectionDetail, CollectionSummary } from "@/lib/collections";

export async function listPublicCollections(limit = 48): Promise<CollectionSummary[]> {
  if (!publicSupabaseEnv()) return [];
  try {
    return await listPublicCollectionsClient(await createAuthServerClient(), limit);
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
  return listPublicCollectionsForHandle(await createAuthServerClient(), handle);
}

export async function getPublicCollectionServer(handle: string, slug: string): Promise<CollectionDetail | null> {
  return getPublicCollection(await createAuthServerClient(), handle, slug);
}

export async function getOwnCollectionServer(id: string): Promise<CollectionDetail | null> {
  const claims = await getAuthClaims();
  if (!claims?.sub || typeof claims.sub !== "string") return null;
  const collection = await getOwnCollection(await createAuthServerClient(), id);
  if (!collection || collection.owner.id !== claims.sub) return null;
  return collection;
}
