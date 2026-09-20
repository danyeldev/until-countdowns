import { describe, expect, it } from "vitest";
import { ANALYTICS_EVENTS, distinctIdFromCookieHeader } from "@/lib/analytics-shared";

describe("analytics event names", () => {
  it("covers the product actions we send to PostHog", () => {
    expect(ANALYTICS_EVENTS.calendarAdded).toBe("calendar_added");
    expect(ANALYTICS_EVENTS.countdownShared).toBe("countdown_shared");
    expect(ANALYTICS_EVENTS.countdownSaved).toBe("countdown_saved");
    expect(ANALYTICS_EVENTS.commentPosted).toBe("comment_posted");
    expect(ANALYTICS_EVENTS.userSignedUp).toBe("user_signed_up");
    expect(ANALYTICS_EVENTS.searchSubmitted).toBe("search_submitted");
  });
});

describe("distinctIdFromCookieHeader", () => {
  it("reads the PostHog distinct id from the project cookie", () => {
    const cookie = `theme=dark; ph_phc_test_posthog=${encodeURIComponent(JSON.stringify({ distinct_id: "abc-123" }))}`;
    expect(distinctIdFromCookieHeader(cookie)).toBe("abc-123");
  });

  it("returns null when the cookie is missing or malformed", () => {
    expect(distinctIdFromCookieHeader(null)).toBeNull();
    expect(distinctIdFromCookieHeader("theme=dark")).toBeNull();
    expect(distinctIdFromCookieHeader("ph_phc_test_posthog=not-json")).toBeNull();
  });
});
