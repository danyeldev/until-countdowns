import { publicSupabaseEnv } from "@/lib/auth/env";
import { profileHref } from "@/lib/auth/profile";
import { eventFromSnapshot, snapshotFromEvent, type SavedSnapshot } from "@/lib/collection";
import { isCatalogEventId } from "@/lib/event-id";
import { collectionEventPath } from "@/lib/personal-collection";
import { CATEGORIES, type Category, type CountdownEvent } from "@/lib/types";
import { isPersonalSlug, personalEventFromRecord } from "@/lib/user-events";

export const COLLECTIONS_MAX = 20;
export const COLLECTION_ITEMS_MAX = 50;
export const COLLECTION_IMAGES_MAX = 6;
export const COLLECTION_TITLE_MAX = 80;
export const COLLECTION_DESCRIPTION_MAX = 500;
export const COLLECTION_IMAGE_BYTES_MAX = 5_242_880;
export const COLLECTION_IMAGE_BUCKET = "collection-images";
export const COLLECTION_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const RESERVED_COLLECTION_SLUGS = new Set([
  "collections",
  "edit",
  "new",
  "settings",
]);

export type CollectionImage = {
  id: string;
  path: string;
  position: number;
};

export type CollectionSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; handle: string };
  itemCount: number;
  images: CollectionImage[];
};

export type CollectionDetail = CollectionSummary & {
  items: CountdownEvent[];
};

export function parseCollectionTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.trim().replace(/\s+/g, " ");
  if (!title || title.length > COLLECTION_TITLE_MAX) return null;
  return title;
}

export function parseCollectionDescription(value: unknown): string | null {
  if (value == null) return "";
  if (typeof value !== "string") return null;
  const description = value.trim();
  if (description.length > COLLECTION_DESCRIPTION_MAX) return null;
  return description;
}

export function slugifyCollectionTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (/^[a-z][a-z0-9-]{1,59}$/.test(slug) && !RESERVED_COLLECTION_SLUGS.has(slug)) return slug;
  const padded = `collection-${slug}`.replace(/-+/g, "-").replace(/-$/g, "").slice(0, 60);
  if (/^[a-z][a-z0-9-]{1,59}$/.test(padded) && !RESERVED_COLLECTION_SLUGS.has(padded)) return padded;
  return "collection";
}

export function parseCollectionSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{1,59}$/.test(slug)) return null;
  if (RESERVED_COLLECTION_SLUGS.has(slug)) return null;
  return slug;
}

export function nextCollectionSlug(title: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugifyCollectionTitle(title);
  if (!used.has(base)) return base;
  for (let index = 2; index < 100; index += 1) {
    const suffix = `-${index}`;
    const next = `${base.slice(0, 60 - suffix.length)}${suffix}`;
    if (parseCollectionSlug(next) && !used.has(next)) return next;
  }
  return `${base.slice(0, 52)}-${Date.now().toString(36)}`.slice(0, 60);
}

export function parseCollectionEventKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (isCatalogEventId(value) || isPersonalSlug(value)) return value;
  return null;
}

export function collectionHref(handle: string, slug: string): string {
  return `${profileHref(handle)}/${slug}`;
}

export function collectionCover(images: CollectionImage[]): CollectionImage | null {
  return images[0] ?? null;
}

export function collectionImageUrl(path: string): string {
  const env = publicSupabaseEnv();
  if (!env || !path) return "";
  return `${env.url}/storage/v1/object/public/${COLLECTION_IMAGE_BUCKET}/${path}`;
}

export function collectionItemHref(event: CountdownEvent): string {
  return collectionEventPath(event, false);
}

export function collectionEventFromSnapshot(eventKey: string, snapshot: unknown): CountdownEvent | null {
  const key = parseCollectionEventKey(eventKey);
  if (!key) return null;
  if (isPersonalSlug(key)) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
    const item = snapshot as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const date = typeof item.date === "string" ? item.date : "";
    if (!title || title.length > 500 || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null;
    return personalEventFromRecord({
      slug: key,
      title,
      date: date.slice(0, 10),
      description: typeof item.description === "string" ? item.description.slice(0, 1000) : "",
      category: CATEGORIES.includes(item.category as Category) ? (item.category as Category) : "culture",
    });
  }
  return eventFromSnapshot(snapshot, key);
}

export function snapshotForCollection(event: CountdownEvent): SavedSnapshot {
  return snapshotFromEvent(event);
}

export function collectionErrorMessage(error: { message?: string; code?: string } | string | null | undefined): string {
  if (!error) return "Could not update that collection. Try again.";
  const message = typeof error === "string" ? error : error.message?.trim() || "";
  const code = typeof error === "string" ? "" : error.code?.trim() || "";
  if (code === "23505") return "You already have a collection with that name.";
  if (code === "P0001" || /collection_limit/.test(message)) {
    return `You can keep ${COLLECTIONS_MAX} public collections. Remove one before adding another.`;
  }
  if (/collection_items_limit/.test(message)) {
    return `A collection can hold ${COLLECTION_ITEMS_MAX} countdowns.`;
  }
  if (/collection_images_limit/.test(message)) {
    return `A collection can have ${COLLECTION_IMAGES_MAX} images.`;
  }
  if (/profile_incomplete/.test(message)) return "Finish your profile before creating a collection.";
  if (code === "42501" || /not authenticated|JWT/i.test(message)) return "Sign in to manage collections.";
  if (message && message.length < 160 && !/https?:\/\//i.test(message) && !/regular expression|permission denied|violates/i.test(message)) {
    return message;
  }
  return "Could not update that collection. Try again.";
}
