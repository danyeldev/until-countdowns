export const LOGIN_PATH = "/login";
export const UPDATE_PASSWORD_PATH = "/login/update-password";
export const COMPLETE_PROFILE_PATH = "/login/complete";
export const AUTH_CALLBACK_PATH = "/auth/callback";
export const DEFAULT_AFTER_AUTH_PATH = "/";

/**
 * Only in-app relative paths. Rejects protocol-relative URLs, backslashes, and
 * the sign-in / callback routes so a crafted `?next=` cannot bounce users
 * off-site or into a loop. `/login/update-password` is allowed (password recovery).
 */
export function safeNextPath(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return DEFAULT_AFTER_AUTH_PATH;
  if (!raw.startsWith("/")) return DEFAULT_AFTER_AUTH_PATH;
  if (raw.startsWith("//") || raw.startsWith("/\\") || raw.includes("\\")) return DEFAULT_AFTER_AUTH_PATH;
  if (raw.includes("://")) return DEFAULT_AFTER_AUTH_PATH;
  const pathOnly = raw.split("?")[0] ?? raw;
  if (
    pathOnly === LOGIN_PATH ||
    pathOnly === COMPLETE_PROFILE_PATH ||
    pathOnly === AUTH_CALLBACK_PATH ||
    pathOnly.startsWith("/auth/")
  ) {
    return DEFAULT_AFTER_AUTH_PATH;
  }
  return raw;
}

export function loginHref(next = DEFAULT_AFTER_AUTH_PATH, extras?: { error?: string; message?: string; mode?: AuthMode }): string {
  const params = new URLSearchParams();
  const destination = safeNextPath(next);
  if (destination !== DEFAULT_AFTER_AUTH_PATH) params.set("next", destination);
  if (extras?.mode && extras.mode !== "signin") params.set("mode", extras.mode);
  if (extras?.error) params.set("error", extras.error);
  if (extras?.message) params.set("message", extras.message);
  const query = params.toString();
  return query ? `${LOGIN_PATH}?${query}` : LOGIN_PATH;
}

export function completeProfileHref(next = DEFAULT_AFTER_AUTH_PATH): string {
  const destination = safeNextPath(next);
  if (destination === DEFAULT_AFTER_AUTH_PATH) return COMPLETE_PROFILE_PATH;
  return `${COMPLETE_PROFILE_PATH}?next=${encodeURIComponent(destination)}`;
}

export const AUTH_MODES = ["signin", "signup", "reset"] as const;
export type AuthMode = (typeof AUTH_MODES)[number];

export function parseAuthMode(value: unknown): AuthMode {
  const raw = Array.isArray(value) ? value[0] : value;
  return AUTH_MODES.includes(raw as AuthMode) ? (raw as AuthMode) : "signin";
}

export function hasSupabaseAuthCookies(cookies: { name: string }[]): boolean {
  return cookies.some((cookie) => cookie.name.startsWith("sb-"));
}

/** Paths that stay behind a session. The public collections directory is open. */
export function isAuthGatedPath(href: string) {
  const path = href.split("?")[0] ?? href;
  return (
    path === "/saved" ||
    path === "/create" ||
    path === "/notifications" ||
    path === "/collections/new" ||
    /^\/collections\/[^/]+\/edit$/.test(path)
  );
}
