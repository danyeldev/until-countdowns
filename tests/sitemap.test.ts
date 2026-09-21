import { describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";

vi.mock("@/lib/catalog", () => ({
  categoryCounts: async () => ({}),
  countryCounts: async () => ({}),
  indexableEvents: async () => [],
  sitemapSeries: async () => [],
  sitemapShardIds: async () => ["hubs", "series"],
  tagsWithAtLeast: async () => [],
}));

vi.mock("@/lib/collections-server", () => ({ listPublicCollections: async () => [] }));
vi.mock("@/lib/featured-collections", () => ({ listFeaturedCollections: async () => [] }));

describe("sitemap discovery", () => {
  it("lists public hubs without inviting crawlers into the sign-in-only create page", async () => {
    const entries = await sitemap({ id: Promise.resolve("hubs") });
    const paths = entries.map(({ url }) => new URL(url).pathname);
    expect(paths).toEqual(expect.arrayContaining(["/", "/days-until", "/category", "/country", "/collections"]));
    expect(paths).not.toContain("/create");
  });
});
