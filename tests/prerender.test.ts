import { afterEach, describe, expect, it, vi } from "vitest";
import { prerenderLimit } from "../src/lib/prerender";
afterEach(() => vi.unstubAllEnvs());
describe("bounded catalog warming", () => {
  it("defaults to on-demand ISR", () => {
    vi.stubEnv("CATALOG_PRERENDER_LIMIT", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(prerenderLimit(500)).toBe(0);
  });
  it("warms a bounded catalog in production when unset", () => {
    vi.stubEnv("CATALOG_PRERENDER_LIMIT", "");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(prerenderLimit(500)).toBe(200);
  });
  it("clamps valid settings and rejects malformed settings", () => {
    vi.stubEnv("CATALOG_PRERENDER_LIMIT", "1000");
    expect(prerenderLimit(50)).toBe(50);
    vi.stubEnv("CATALOG_PRERENDER_LIMIT", "12");
    expect(prerenderLimit(50)).toBe(12);
    vi.stubEnv("VERCEL_ENV", "preview");
    for (const value of ["-1", "NaN", "1.5", "Infinity"]) {
      vi.stubEnv("CATALOG_PRERENDER_LIMIT", value);
      expect(prerenderLimit(500)).toBe(0);
    }
  });
});
