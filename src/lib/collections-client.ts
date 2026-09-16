import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";
import type { CountdownEvent } from "@/lib/types";
import {
  COLLECTION_IMAGE_BUCKET,
  COLLECTION_IMAGE_BYTES_MAX,
  COLLECTION_IMAGE_TYPES,
  COLLECTION_IMAGES_MAX,
  type CollectionDetail,
  type CollectionImage,
  type CollectionSummary,
  collectionErrorMessage,
  collectionEventFromSnapshot,
  nextCollectionSlug,
  parseCollectionDescription,
  slugifyCollectionTitle,
  parseCollectionEventKey,
  parseCollectionSlug,
  parseCollectionTitle,
  snapshotForCollection,
} from "./collections";

type CollectionClient = SupabaseClient<Database>;

type CollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  profiles: { name: string; handle: string | null } | { name: string; handle: string | null }[] | null;
  event_collection_items: { event_key: string }[] | null;
  event_collection_images: { id: string; path: string; position: number }[] | null;
};

type CollectionItemRow = {
  event_key: string;
  snapshot: Json;
  position: number;
  added_at: string;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function imagesFromRow(row: CollectionRow): CollectionImage[] {
  return [...(row.event_collection_images ?? [])]
    .sort((left, right) => left.position - right.position)
    .map((image) => ({ id: image.id, path: image.path, position: image.position }));
}

function summaryFromRow(row: CollectionRow): CollectionSummary | null {
  const profile = first(row.profiles);
  const handle = profile?.handle?.trim() || "";
  if (!handle) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    owner: {
      id: row.owner_id,
      name: profile?.name?.trim() || handle,
      handle,
    },
    itemCount: row.event_collection_items?.length ?? 0,
    images: imagesFromRow(row),
  };
}

const COLLECTION_SELECT =
  "id, slug, title, description, created_at, updated_at, owner_id, profiles!event_collections_owner_id_fkey(name, handle), event_collection_items(event_key), event_collection_images(id, path, position)";

export async function listOwnCollections(client: CollectionClient, ownerId: string): Promise<CollectionSummary[]> {
  const { data, error } = await client
    .from("event_collections")
    .select(COLLECTION_SELECT)
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(collectionErrorMessage(error));
  return ((data ?? []) as CollectionRow[]).flatMap((row) => {
    const item = summaryFromRow(row);
    return item ? [item] : [];
  });
}

export async function listPublicCollections(
  client: CollectionClient,
  limit = 48,
): Promise<CollectionSummary[]> {
  const { data, error } = await client
    .from("event_collections")
    .select(COLLECTION_SELECT)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(collectionErrorMessage(error));
  return ((data ?? []) as CollectionRow[]).flatMap((row) => {
    const item = summaryFromRow(row);
    return item ? [item] : [];
  });
}

export async function listPublicCollectionsForHandle(
  client: CollectionClient,
  handle: string,
): Promise<CollectionSummary[]> {
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id")
    .eq("handle", handle)
    .maybeSingle();
  if (profileError) throw new Error(collectionErrorMessage(profileError));
  if (!profile) return [];
  const { data, error } = await client
    .from("event_collections")
    .select(COLLECTION_SELECT)
    .eq("owner_id", profile.id)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(collectionErrorMessage(error));
  return ((data ?? []) as CollectionRow[]).flatMap((row) => {
    const item = summaryFromRow(row);
    return item ? [item] : [];
  });
}

export async function getPublicCollection(
  client: CollectionClient,
  handle: string,
  slug: string,
): Promise<CollectionDetail | null> {
  const parsed = parseCollectionSlug(slug);
  if (!parsed) return null;
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id")
    .eq("handle", handle)
    .maybeSingle();
  if (profileError) throw new Error(collectionErrorMessage(profileError));
  if (!profile) return null;
  const { data, error } = await client
    .from("event_collections")
    .select(COLLECTION_SELECT)
    .eq("owner_id", profile.id)
    .eq("slug", parsed)
    .maybeSingle();
  if (error) throw new Error(collectionErrorMessage(error));
  if (!data) return null;
  const summary = summaryFromRow(data as CollectionRow);
  if (!summary) return null;
  const { data: itemRows, error: itemError } = await client
    .from("event_collection_items")
    .select("event_key, snapshot, position, added_at")
    .eq("collection_id", summary.id)
    .order("position", { ascending: true })
    .order("added_at", { ascending: true });
  if (itemError) throw new Error(collectionErrorMessage(itemError));
  return {
    ...summary,
    items: ((itemRows ?? []) as CollectionItemRow[]).flatMap((row) => {
      const event = collectionEventFromSnapshot(row.event_key, row.snapshot);
      return event ? [event] : [];
    }),
  };
}

export async function getOwnCollection(client: CollectionClient, id: string): Promise<CollectionDetail | null> {
  const { data, error } = await client.from("event_collections").select(COLLECTION_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(collectionErrorMessage(error));
  if (!data) return null;
  const summary = summaryFromRow(data as CollectionRow);
  if (!summary) return null;
  const { data: itemRows, error: itemError } = await client
    .from("event_collection_items")
    .select("event_key, snapshot, position, added_at")
    .eq("collection_id", summary.id)
    .order("position", { ascending: true })
    .order("added_at", { ascending: true });
  if (itemError) throw new Error(collectionErrorMessage(itemError));
  return {
    ...summary,
    items: ((itemRows ?? []) as CollectionItemRow[]).flatMap((row) => {
      const event = collectionEventFromSnapshot(row.event_key, row.snapshot);
      return event ? [event] : [];
    }),
  };
}

export async function listCollectionIdsForEvent(
  client: CollectionClient,
  eventKey: string,
  ownerId: string,
): Promise<string[]> {
  const key = parseCollectionEventKey(eventKey);
  if (!key) return [];
  const { data, error } = await client
    .from("event_collection_items")
    .select("collection_id, event_collections!inner(owner_id)")
    .eq("event_key", key)
    .eq("event_collections.owner_id", ownerId);
  if (error) throw new Error(collectionErrorMessage(error));
  return (data ?? []).map((row) => row.collection_id);
}

export async function createEventCollection(
  client: CollectionClient,
  input: { title: string; description?: string; ownerId: string; takenSlugs?: string[] },
): Promise<CollectionSummary> {
  const title = parseCollectionTitle(input.title);
  const description = parseCollectionDescription(input.description ?? "");
  if (!title || description == null) throw new Error("Add a title of up to 80 characters.");
  const slug = nextCollectionSlug(title, input.takenSlugs ?? []);
  const { data, error } = await client
    .from("event_collections")
    .insert({ owner_id: input.ownerId, title, description, slug })
    .select(COLLECTION_SELECT)
    .single();
  if (error) throw new Error(collectionErrorMessage(error));
  const summary = summaryFromRow(data as CollectionRow);
  if (!summary) throw new Error("Could not create that collection. Try again.");
  return summary;
}

export async function updateEventCollection(
  client: CollectionClient,
  id: string,
  input: { title: string; description?: string; currentSlug: string; takenSlugs?: string[] },
): Promise<void> {
  const title = parseCollectionTitle(input.title);
  const description = parseCollectionDescription(input.description ?? "");
  if (!title || description == null) throw new Error("Add a title of up to 80 characters.");
  const desired = slugifyCollectionTitle(title);
  const others = (input.takenSlugs ?? []).filter((slug) => slug !== input.currentSlug);
  const slug =
    desired === input.currentSlug || !others.includes(desired)
      ? (parseCollectionSlug(desired) ?? input.currentSlug)
      : nextCollectionSlug(title, others);
  const { error } = await client.from("event_collections").update({ title, description, slug }).eq("id", id);
  if (error) throw new Error(collectionErrorMessage(error));
}

export async function deleteEventCollection(client: CollectionClient, collection: CollectionSummary): Promise<void> {
  if (collection.images.length) {
    await client.storage.from(COLLECTION_IMAGE_BUCKET).remove(collection.images.map((image) => image.path));
  }
  const { error } = await client.from("event_collections").delete().eq("id", collection.id);
  if (error) throw new Error(collectionErrorMessage(error));
}

export async function addEventToCollection(
  client: CollectionClient,
  collectionId: string,
  event: CountdownEvent,
): Promise<void> {
  const eventKey = parseCollectionEventKey(event.slug) ?? parseCollectionEventKey(event.id);
  if (!eventKey) throw new Error("This countdown cannot be added to a public collection.");
  const { data: existing } = await client
    .from("event_collection_items")
    .select("position")
    .eq("collection_id", collectionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await client.from("event_collection_items").insert({
    collection_id: collectionId,
    event_key: eventKey,
    snapshot: snapshotForCollection(event) as unknown as Json,
    position: (existing?.position ?? -1) + 1,
  });
  if (error) throw new Error(collectionErrorMessage(error));
}

export async function removeEventFromCollection(
  client: CollectionClient,
  collectionId: string,
  eventKey: string,
): Promise<void> {
  const key = parseCollectionEventKey(eventKey);
  if (!key) return;
  const { error } = await client
    .from("event_collection_items")
    .delete()
    .eq("collection_id", collectionId)
    .eq("event_key", key);
  if (error) throw new Error(collectionErrorMessage(error));
}

export function assertCollectionImageFile(file: File): void {
  if (!COLLECTION_IMAGE_TYPES.includes(file.type as (typeof COLLECTION_IMAGE_TYPES)[number])) {
    throw new Error("Use a JPEG, PNG, or WebP image.");
  }
  if (file.size > COLLECTION_IMAGE_BYTES_MAX) throw new Error("Keep each image under 5 MB.");
}

function imageExtension(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function uploadCollectionImages(
  client: CollectionClient,
  collection: Pick<CollectionSummary, "id" | "owner" | "images">,
  files: File[],
): Promise<void> {
  if (!files.length) return;
  if (collection.images.length + files.length > COLLECTION_IMAGES_MAX) {
    throw new Error(`A collection can have ${COLLECTION_IMAGES_MAX} images.`);
  }
  let position = collection.images.reduce((max, image) => Math.max(max, image.position), -1);
  for (const file of files) {
    assertCollectionImageFile(file);
    position += 1;
    const path = `${collection.owner.id}/${collection.id}/${crypto.randomUUID()}.${imageExtension(file)}`;
    const { error: uploadError } = await client.storage.from(COLLECTION_IMAGE_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (uploadError) throw new Error(collectionErrorMessage(uploadError));
    const { error } = await client.from("event_collection_images").insert({
      collection_id: collection.id,
      path,
      position,
    });
    if (error) throw new Error(collectionErrorMessage(error));
  }
}

export async function deleteCollectionImage(
  client: CollectionClient,
  image: CollectionImage,
): Promise<void> {
  await client.storage.from(COLLECTION_IMAGE_BUCKET).remove([image.path]);
  const { error } = await client.from("event_collection_images").delete().eq("id", image.id);
  if (error) throw new Error(collectionErrorMessage(error));
}
