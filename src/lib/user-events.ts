import type { Category, CountdownEvent } from "./types";

const MINE_KEY = "until:mine";
const SAVED_KEY = "until:saved";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function userEventFromDraft(draft: {
  title: string;
  date: string;
  description?: string;
  category?: Category;
}): CountdownEvent {
  const day = draft.date.slice(0, 10);
  const slug = `mine-${slugify(draft.title) || "event"}-${day}`;
  return {
    id: slug,
    slug,
    title: draft.title.trim(),
    description: (draft.description || "A countdown you made.").trim(),
    date: day,
    allDay: true,
    category: draft.category || "culture",
    tags: ["mine"],
    regions: ["GLOBAL"],
    source: "user",
    featured: false,
    popularity: 10,
  };
}

export function encodeSharePayload(event: CountdownEvent): string {
  const raw = JSON.stringify({
    t: event.title,
    d: event.date,
    b: event.description,
    c: event.category,
  });
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function decodeSharePayload(payload: string): CountdownEvent | null {
  try {
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(padded)));
    const data = JSON.parse(json) as { t?: string; d?: string; b?: string; c?: Category };
    if (!data.t || !data.d) return null;
    return userEventFromDraft({
      title: data.t,
      date: data.d,
      description: data.b,
      category: data.c,
    });
  } catch {
    return null;
  }
}

export function loadMine(): CountdownEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MINE_KEY);
    return raw ? (JSON.parse(raw) as CountdownEvent[]) : [];
  } catch {
    return [];
  }
}

export function saveMine(events: CountdownEvent[]) {
  localStorage.setItem(MINE_KEY, JSON.stringify(events));
  window.dispatchEvent(new Event("until:store"));
}

export function upsertMine(event: CountdownEvent): CountdownEvent[] {
  const next = [event, ...loadMine().filter((e) => e.id !== event.id)];
  saveMine(next);
  return next;
}

export function removeMine(id: string): CountdownEvent[] {
  const next = loadMine().filter((e) => e.id !== id);
  saveMine(next);
  return next;
}

export function loadSaved(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function toggleSaved(id: string): string[] {
  const cur = loadSaved();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur];
  localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("until:store"));
  return next;
}

function subscribeStore(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("until:store", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("until:store", cb);
  };
}

export function getMineSnapshot(): string {
  return localStorage.getItem(MINE_KEY) ?? "[]";
}

export function getSavedSnapshot(): string {
  return localStorage.getItem(SAVED_KEY) ?? "[]";
}

export function emptySnapshot(): string {
  return "[]";
}

export { subscribeStore };
