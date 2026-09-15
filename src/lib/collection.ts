import { isCatalogEventId } from "./event-id";
import { CATEGORIES, type Category, type CountdownEvent, type DatePrecision, type EventStatus } from "./types";
import { COLLECTION_MAX, isPersonalSlug, personalEventFromRecord } from "./user-events";

const PRECISIONS: DatePrecision[] = ["instant", "day", "month", "quarter", "year", "decade"];
const STATUSES: EventStatus[] = ["scheduled", "tentative", "postponed", "cancelled", "done", "retired"];

export { COLLECTION_MAX };

export function collectionErrorMessage(error: { message?: string; code?: string } | string | null | undefined): string {
  if (!error) return "Could not update your collection. Try again.";
  const message = typeof error === "string" ? error : error.message?.trim() || "";
  const code = typeof error === "string" ? "" : error.code?.trim() || "";
  if (code === "P0001" || message.includes("collection_limit")) {
    return `You have ${COLLECTION_MAX} items in this collection. Remove one before adding another.`;
  }
  if (code === "42501" || /not authenticated|JWT/i.test(message)) return "Sign in to save this countdown.";
  if (message && message.length < 160 && !/https?:\/\//i.test(message) && !/regular expression|permission denied|violates/i.test(message)) return message;
  return "Could not update your collection. Try again.";
}

export function isPersonalCollectionEvent(event?: Pick<CountdownEvent, "source" | "id" | "slug"> | null, id?: string): boolean {
  if (event?.source === "user" || isPersonalSlug(event?.id) || isPersonalSlug(event?.slug)) return true;
  return isPersonalSlug(id);
}

export type SavedSnapshot = {
  id: string;
  slug: string;
  title: string;
  date: string;
  description: string;
  allDay: boolean;
  category: Category;
  timezone?: string;
  endDate?: string;
  status?: EventStatus;
  datePrecision?: DatePrecision;
  source: CountdownEvent["source"];
};

export function snapshotFromEvent(event: CountdownEvent): SavedSnapshot {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    date: event.date,
    description: event.description.slice(0, 1000),
    allDay: event.allDay !== false,
    category: event.category,
    timezone: event.timezone,
    endDate: event.endDate,
    status: event.status,
    datePrecision: event.datePrecision,
    source: event.source === "user" ? "user" : "catalog",
  };
}

export function eventFromSnapshot(value: unknown, fallbackId?: string): CountdownEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id : fallbackId;
  if (!id || !isCatalogEventId(id)
    || typeof item.slug !== "string" || !/^[a-z0-9-]{1,256}$/.test(item.slug)
    || typeof item.title !== "string" || !item.title.trim() || item.title.length > 500
    || typeof item.date !== "string" || !Number.isFinite(Date.parse(item.date))
    || !CATEGORIES.includes(item.category as Category)) return null;
  return {
    id, slug: item.slug, title: item.title, date: item.date,
    description: typeof item.description === "string" ? item.description.slice(0, 1000) : "",
    allDay: item.allDay !== false, category: item.category as Category,
    timezone: typeof item.timezone === "string" ? item.timezone : undefined,
    endDate: typeof item.endDate === "string" && Number.isFinite(Date.parse(item.endDate)) ? item.endDate : undefined,
    status: STATUSES.includes(item.status as EventStatus) ? item.status as EventStatus : undefined,
    datePrecision: PRECISIONS.includes(item.datePrecision as DatePrecision) ? item.datePrecision as DatePrecision : undefined,
    source: item.source === "user" ? "user" : "catalog",
    tags: [], regions: [], featured: false, popularity: 0,
  };
}

export function countdownFromRow(row: {
  slug: string;
  title: string;
  date: string;
  description: string;
  category: string;
}): CountdownEvent {
  return personalEventFromRecord({
    slug: row.slug,
    title: row.title,
    date: row.date,
    description: row.description,
    category: CATEGORIES.includes(row.category as Category) ? row.category as Category : "culture",
  });
}
