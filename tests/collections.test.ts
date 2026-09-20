import { describe, expect, it, vi } from "vitest";
import {
  collectionErrorMessage,
  collectionEventFromSnapshot,
  collectionHref,
  collectionIcsPath,
  collectionImageUrl,
  nextCollectionSlug,
  parseCollectionDescription,
  parseCollectionEventKey,
  parseCollectionSlug,
  parseCollectionTitle,
  rememberPendingCollection,
  slugifyCollectionTitle,
  takePendingCollection,
} from "@/lib/collections";
import {
  FEATURED_COLLECTION_SLUGS,
  featuredCollectionHref,
  featuredCollectionIcsPath,
  parseFeaturedCollectionSlug,
} from "@/lib/featured-collections";
import { matchFeaturedCollections } from "@/lib/search-collections";

describe("public collections", () => {
  it("parses title, description, and slugs", () => {
    expect(parseCollectionTitle("  Autumn nights  ")).toBe("Autumn nights");
    expect(parseCollectionTitle("")).toBeNull();
    expect(parseCollectionDescription("A short list.")).toBe("A short list.");
    expect(parseCollectionDescription("x".repeat(501))).toBeNull();
    expect(slugifyCollectionTitle("Autumn nights!")).toBe("autumn-nights");
    expect(parseCollectionSlug("autumn-nights")).toBe("autumn-nights");
    expect(parseCollectionSlug("new")).toBeNull();
    expect(parseCollectionSlug("1autumn")).toBeNull();
    expect(nextCollectionSlug("Autumn nights", ["autumn-nights"])).toBe("autumn-nights-2");
  });

  it("accepts catalog and personal event keys, not share payloads", () => {
    expect(parseCollectionEventKey("halloween-2026-10-31")).toBe("halloween-2026-10-31");
    expect(parseCollectionEventKey("mine-trip-2026-10-31")).toBe("mine-trip-2026-10-31");
    expect(parseCollectionEventKey("share-abc")).toBeNull();
  });

  it("builds a public collection path from handle and slug", () => {
    expect(collectionHref("ada", "autumn-nights")).toBe("/ada/autumn-nights");
    expect(collectionIcsPath("ada", "autumn-nights")).toBe(
      "/ics/collection/ada/autumn-nights.ics",
    );
  });

  it("serves collection photos from the R2 public host when configured", () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://images.until.day");
    expect(collectionImageUrl("user/col/one.jpg")).toBe("https://images.until.day/user/col/one.jpg");
    vi.unstubAllEnvs();
  });

  it("rehydrates catalog and personal snapshots", () => {
    const catalog = collectionEventFromSnapshot("halloween-2026-10-31", {
      id: "halloween-2026-10-31",
      slug: "halloween-2026-10-31",
      title: "Halloween",
      date: "2026-10-31",
      description: "Candy.",
      allDay: true,
      category: "culture",
      source: "catalog",
    });
    expect(catalog?.title).toBe("Halloween");
    const personal = collectionEventFromSnapshot("mine-trip-2026-11-01", {
      title: "Trip",
      date: "2026-11-01",
      description: "Go.",
      category: "culture",
      source: "user",
    });
    expect(personal?.slug).toBe("mine-trip-2026-11-01");
    expect(personal?.source).toBe("user");
  });

  it("maps limit errors without leaking internals", () => {
    expect(collectionErrorMessage({ code: "P0001", message: "collection_limit" })).toMatch(/20/);
    expect(collectionErrorMessage({ message: "permission denied for table" })).toMatch(/Could not update/);
  });

  it("remembers a collection add until it is taken once", () => {
    if (typeof sessionStorage === "undefined") {
      const data = new Map<string, string>();
      Object.defineProperty(globalThis, "sessionStorage", {
        configurable: true,
        value: {
          getItem: (key: string) => data.get(key) ?? null,
          setItem: (key: string, value: string) => {
            data.set(key, value);
          },
          removeItem: (key: string) => {
            data.delete(key);
          },
        },
      });
    }
    rememberPendingCollection("halloween-2026-10-31");
    expect(takePendingCollection()).toBe("halloween-2026-10-31");
    expect(takePendingCollection()).toBeNull();
    rememberPendingCollection("");
    expect(takePendingCollection()).toBeNull();
  });
});

describe("featured collections", () => {
  it("accepts the editorial slugs and builds public paths", () => {
    expect(FEATURED_COLLECTION_SLUGS).toContain("scream-this-month");
    expect(parseFeaturedCollectionSlug("get-drunk-this-week")).toBe("get-drunk-this-week");
    expect(parseFeaturedCollectionSlug("sports")).toBeNull();
    expect(parseFeaturedCollectionSlug("new")).toBeNull();
    expect(featuredCollectionHref("get-drunk-this-week")).toBe(
      "/collections/featured/get-drunk-this-week",
    );
    expect(featuredCollectionIcsPath("get-drunk-this-week")).toBe(
      "/ics/featured/get-drunk-this-week.ics",
    );
  });

  it("matches editorial lists from search queries", () => {
    expect(matchFeaturedCollections("horror").map((hit) => hit.href)).toContain(
      "/collections/featured/scream-this-month",
    );
    expect(matchFeaturedCollections("drunk").map((hit) => hit.title)).toContain(
      "Festivals to get drunk this week",
    );
    expect(matchFeaturedCollections("pirate")[0]?.href).toBe(
      "/collections/featured/holidays-nobody-asked-for",
    );
    expect(matchFeaturedCollections("sports")).toEqual([]);
    expect(matchFeaturedCollections("h")).toEqual([]);
  });
});
