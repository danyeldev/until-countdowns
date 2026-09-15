import { CATEGORIES, type Category, type CountdownEvent } from "./types";

export const USER_TITLE_MAX = 120;
export const USER_NOTE_MAX = 500;
export const SHARE_PAYLOAD_MAX = 2000;
export const COLLECTION_MAX = 200;

function slugify(input: string) {
  return input.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
}

function titleHash(input: string): string {
  let hash = 2166136261;
  for (const character of input) hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 16777619);
  return (hash >>> 0).toString(36);
}

export function isPersonalDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isPersonalSlug(value: unknown): value is string {
  return typeof value === "string" && /^mine-[a-z0-9-]{1,200}$/.test(value);
}

type UserDraft = { title: string; date: string; description?: string; category?: Category };

export function isUserDraft(value: unknown): value is UserDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  return typeof draft.title === "string" && draft.title.trim().length > 0 && draft.title.length <= USER_TITLE_MAX
    && isPersonalDate(draft.date)
    && (draft.description === undefined || (typeof draft.description === "string" && draft.description.length <= USER_NOTE_MAX))
    && (draft.category === undefined || CATEGORIES.includes(draft.category as Category));
}

export function userEventFromDraft(draft: UserDraft): CountdownEvent {
  const day = draft.date.slice(0, 10);
  const title = draft.title.trim();
  const slug = `mine-${slugify(title) || `event-${titleHash(title)}`}-${day}`;
  return {
    id: slug, slug, title, description: draft.description?.trim() || "A countdown you made.",
    date: day, allDay: true, category: draft.category || "culture", tags: ["mine"],
    regions: ["GLOBAL"], source: "user", featured: false, popularity: 10,
  };
}

export function personalEventFromRecord(record: {
  slug?: string;
  title: string;
  date: string;
  description?: string;
  category?: Category;
}): CountdownEvent {
  const event = userEventFromDraft(record);
  if (isPersonalSlug(record.slug)) event.id = event.slug = record.slug;
  return event;
}

export function assertUserEvent(event: CountdownEvent): CountdownEvent {
  if (!isUserDraft(event)) throw new Error("Add a title and a valid date. Use up to 120 characters for the title and 500 for the note.");
  return personalEventFromRecord(event);
}

/** UTF-8 base64url, bounded to a URL the app's share and embed routes can accept. */
export function encodeSharePayload(event: CountdownEvent): string {
  if (!isUserDraft(event)) return "";
  const bytes = new TextEncoder().encode(JSON.stringify({ t: event.title, d: event.date, b: event.description, c: event.category }));
  const payload = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return payload.length <= SHARE_PAYLOAD_MAX ? payload : "";
}

export function decodeSharePayload(payload: string): CountdownEvent | null {
  if (!payload || payload.length > SHARE_PAYLOAD_MAX || !/^[A-Za-z0-9_-]+$/.test(payload) || payload.length % 4 === 1) return null;
  try {
    const binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const json = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
    const data: unknown = JSON.parse(json);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const item = data as Record<string, unknown>;
    const draft = { title: item.t, date: item.d, description: item.b, category: item.c ?? "culture" };
    return isUserDraft(draft) ? userEventFromDraft(draft) : null;
  } catch {
    return null;
  }
}
