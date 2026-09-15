export const NAME_MAX = 80;
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
export const SIGNUP_PROFILE_KEY = "until:signup-profile";

const RESERVED_HANDLES = new Set([
  "about",
  "admin",
  "api",
  "attributions",
  "auth",
  "calendar",
  "category",
  "complete",
  "country",
  "create",
  "embed",
  "event",
  "favicon",
  "help",
  "icon",
  "login",
  "manifest",
  "me",
  "mine",
  "notifications",
  "og",
  "profile",
  "robots",
  "saved",
  "settings",
  "share",
  "sitemap",
  "support",
  "tag",
  "until",
  "user",
  "users",
  "www",
]);

export function parseName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > NAME_MAX) return null;
  return name;
}

export function normalizeHandleInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, HANDLE_MAX);
}

export function parseHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const handle = normalizeHandleInput(value);
  if (!/^[a-z][a-z0-9_]{2,19}$/.test(handle)) return null;
  if (RESERVED_HANDLES.has(handle)) return null;
  return handle;
}

export function nameError(value: unknown): string | null {
  return parseName(value) ? null : "Enter your name.";
}

export function handleError(value: unknown): string | null {
  if (typeof value !== "string") return "Choose a handle.";
  const handle = normalizeHandleInput(value);
  if (handle.length < HANDLE_MIN) return `Choose a handle with at least ${HANDLE_MIN} characters.`;
  if (!/^[a-z]/.test(handle)) return "Handles start with a letter.";
  if (RESERVED_HANDLES.has(handle)) return "That handle is reserved. Try another.";
  if (!parseHandle(handle)) return "Use letters, numbers and underscores only.";
  return null;
}

export function profileHref(handle: string): string {
  const parsed = parseHandle(handle);
  return parsed ? `/${parsed}` : "/";
}

/** First path segment for `/{handle}`, with an optional leading `@`. */
export function parseProfileParam(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return parseHandle(value.startsWith("@") ? value.slice(1) : value);
}

export function readSignupProfile(value: unknown): { name: string; handle: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const name = parseName(record.name);
  const handle = parseHandle(record.handle);
  if (!name || !handle) return null;
  return { name, handle };
}
