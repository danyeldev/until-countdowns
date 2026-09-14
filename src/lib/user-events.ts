import { CATEGORIES, type Category, type CountdownEvent, type DatePrecision, type EventStatus } from "./types";

const MINE_KEY = "until:mine";
const SAVED_KEY = "until:saved";
const SAVED_EVENTS_KEY = "until:saved-events:v1";
const MAX_RECORDS = 200;
const MAX_STORAGE_CHARS = 1_000_000;
export const USER_TITLE_MAX = 120;
export const USER_NOTE_MAX = 500;
export const SHARE_PAYLOAD_MAX = 2000;

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

type UserDraft = { title: string; date: string; description?: string; category?: Category };

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

function validDraft(value: unknown): value is UserDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  return typeof draft.title === "string" && draft.title.trim().length > 0 && draft.title.length <= USER_TITLE_MAX
    && isPersonalDate(draft.date)
    && (draft.description === undefined || (typeof draft.description === "string" && draft.description.length <= USER_NOTE_MAX))
    && (draft.category === undefined || CATEGORIES.includes(draft.category as Category));
}

/** UTF-8 base64url, bounded to a URL the app's share and embed routes can accept. */
export function encodeSharePayload(event: CountdownEvent): string {
  if (!validDraft(event)) return "";
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
    return validDraft(draft) ? userEventFromDraft(draft) : null;
  } catch {
    return null;
  }
}

function readRaw(key: string): string {
  if (typeof window === "undefined") return "[]";
  try {
    const value = window.localStorage.getItem(key);
    return value && value.length <= MAX_STORAGE_CHARS ? value : "[]";
  } catch {
    return "[]";
  }
}

function readArray(raw: string): unknown[] {
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.slice(0, MAX_RECORDS) : [];
  } catch {
    return [];
  }
}

/** Throws a useful error; callers must not announce a successful save when storage is blocked. */
function writeRaw(key: string, data: unknown): void {
  if (typeof window === "undefined") throw new Error("Saving is available in your browser.");
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    throw new Error("Could not save on this device. Allow browser storage or free up space, then try again.");
  }
}

function notifyStore(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("until:store"));
}

export function parseMine(raw: string): CountdownEvent[] {
  const events = readArray(raw).flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const record = value as Record<string, unknown>;
    if (typeof record.title !== "string" || !record.title.trim() || record.title.length > 5000 || !isPersonalDate(record.date)
      || (record.description !== undefined && (typeof record.description !== "string" || record.description.length > 50_000))) return [];
    // Preserve older notes that predate form limits; they remain local even if too long to share.
    const event = userEventFromDraft({ title: record.title, date: record.date, description: record.description as string | undefined, category: CATEGORIES.includes(record.category as Category) ? record.category as Category : "culture" });
    // Existing personal links survive the addition of Unicode-safe fallback slugs.
    if (typeof record.slug === "string" && /^mine-[a-z0-9-]{1,200}$/.test(record.slug)) event.id = event.slug = record.slug;
    return [event];
  });
  return [...new Map(events.map((event) => [event.id, event])).values()];
}

export function loadMine(): CountdownEvent[] { return parseMine(getMineSnapshot()); }

export function saveMine(events: CountdownEvent[]): void {
  const valid = parseMine(JSON.stringify(events));
  writeRaw(MINE_KEY, valid);
  notifyStore();
}

export function upsertMine(event: CountdownEvent): CountdownEvent[] {
  if (!validDraft(event)) throw new Error("Add a title and a valid date. Use up to 120 characters for the title and 500 for the note.");
  const current = loadMine().filter((item) => item.id !== event.id);
  if (current.length >= MAX_RECORDS) throw new Error("This device has 200 personal countdowns. Remove one before adding another.");
  const next = [event, ...current];
  saveMine(next);
  return next;
}

export function removeMine(id: string): CountdownEvent[] {
  const next = loadMine().filter((event) => event.id !== id);
  if (loadSaved().includes(id)) toggleSaved(id);
  saveMine(next);
  return next;
}

export function parseSavedIds(raw: string): string[] {
  return [...new Set(readArray(raw).filter((id): id is string => typeof id === "string" && /^[a-zA-Z0-9_-]{1,256}$/.test(id)))];
}

export function loadSaved(): string[] { return parseSavedIds(getSavedSnapshot()); }

const PRECISIONS: DatePrecision[] = ["instant", "day", "month", "quarter", "year", "decade"];
const STATUSES: EventStatus[] = ["scheduled", "tentative", "postponed", "cancelled", "done", "retired"];

/** Small validated snapshots make saved dates browsable even while the catalog is unavailable. */
export function parseSavedEvents(raw: string): CountdownEvent[] {
  return readArray(raw).flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    if (typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,256}$/.test(item.id)
      || typeof item.slug !== "string" || !/^[a-z0-9-]{1,256}$/.test(item.slug)
      || typeof item.title !== "string" || !item.title.trim() || item.title.length > 500
      || typeof item.date !== "string" || !Number.isFinite(Date.parse(item.date))
      || !CATEGORIES.includes(item.category as Category)) return [];
    return [{
      id: item.id, slug: item.slug, title: item.title, date: item.date,
      description: typeof item.description === "string" ? item.description.slice(0, 1000) : "",
      allDay: item.allDay !== false, category: item.category as Category,
      timezone: typeof item.timezone === "string" ? item.timezone : undefined,
      endDate: typeof item.endDate === "string" && Number.isFinite(Date.parse(item.endDate)) ? item.endDate : undefined,
      status: STATUSES.includes(item.status as EventStatus) ? item.status as EventStatus : undefined,
      datePrecision: PRECISIONS.includes(item.datePrecision as DatePrecision) ? item.datePrecision as DatePrecision : undefined,
      source: item.source === "user" ? "user" : "catalog",
      tags: [], regions: [], featured: false, popularity: 0,
    }];
  });
}

export function cacheSavedEvents(events: CountdownEvent[]): void {
  const ids = new Set(loadSaved());
  const merged = new Map(parseSavedEvents(getSavedEventsSnapshot()).map((event) => [event.id, event]));
  for (const event of events) if (ids.has(event.id)) merged.set(event.id, event);
  const snapshots = [...merged.values()].filter((event) => ids.has(event.id));
  writeRaw(SAVED_EVENTS_KEY, parseSavedEvents(JSON.stringify(snapshots)));
  notifyStore();
}

export function toggleSaved(id: string, event?: CountdownEvent): string[] {
  if (!/^[a-zA-Z0-9_-]{1,256}$/.test(id)) throw new Error("This countdown cannot be saved.");
  const current = loadSaved();
  const removing = current.includes(id);
  if (!removing && current.length >= MAX_RECORDS) throw new Error("You have 200 saved countdowns. Remove one before saving another.");
  const next = removing ? current.filter((value) => value !== id) : [id, ...current];
  if (event && !removing) {
    const snapshot = parseSavedEvents(JSON.stringify([event]));
    if (!snapshot.length || event.id !== id) throw new Error("This countdown could not be saved. Refresh the page and try again.");
    const records = parseSavedEvents(getSavedEventsSnapshot()).filter((item) => item.id !== id && current.includes(item.id));
    writeRaw(SAVED_EVENTS_KEY, [...snapshot, ...records].slice(0, MAX_RECORDS));
  } else if (removing) {
    writeRaw(SAVED_EVENTS_KEY, parseSavedEvents(getSavedEventsSnapshot()).filter((item) => item.id !== id));
  }
  writeRaw(SAVED_KEY, next);
  notifyStore();
  return next;
}

function subscribeStore(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("until:store", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("until:store", callback);
  };
}

export function getMineSnapshot(): string { return readRaw(MINE_KEY); }
export function getSavedSnapshot(): string { return readRaw(SAVED_KEY); }
export function getSavedEventsSnapshot(): string { return readRaw(SAVED_EVENTS_KEY); }
export function emptySnapshot(): string { return "[]"; }
export { subscribeStore };
