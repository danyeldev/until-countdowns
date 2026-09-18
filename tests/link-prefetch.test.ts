import { describe, expect, it } from "vitest";
import { isPerRequestRoute, NO_PREFETCH } from "@/lib/link-prefetch";

describe("isPerRequestRoute", () => {
  it("names the routes the chrome must not prefetch, in any locale", () => {
    for (const href of ["/login", "/login?next=%2Fcreate", "/login/complete", "/create", "/saved", "/notifications", "/calendar", "/es/calendar", "/ja/create", "/collections/new"]) {
      expect(isPerRequestRoute(href), href).toBe(true);
    }
    expect(NO_PREFETCH).toEqual({ prefetch: false });
  });

  it("leaves the cached catalog alone", () => {
    for (const href of ["/", "/collections", "/category", "/days-until", "/country", "/about", "/calendar/2026/09", "/event/new-year", "/es/event/new-year"]) {
      expect(isPerRequestRoute(href), href).toBe(false);
    }
  });
});
