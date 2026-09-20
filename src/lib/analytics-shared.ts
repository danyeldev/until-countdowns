export const ANALYTICS_EVENTS = {
  calendarAdded: "calendar_added",
  countdownShared: "countdown_shared",
  countdownSaved: "countdown_saved",
  countdownUnsaved: "countdown_unsaved",
  commentPosted: "comment_posted",
  userSignedUp: "user_signed_up",
  searchSubmitted: "search_submitted",
} as const;

export function distinctIdFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name.startsWith("ph_") || !name.endsWith("_posthog")) continue;
    try {
      const parsed = JSON.parse(decodeURIComponent(part.slice(eq + 1).trim())) as { distinct_id?: unknown };
      if (typeof parsed.distinct_id === "string" && parsed.distinct_id) return parsed.distinct_id;
    } catch {
      continue;
    }
  }
  return null;
}
