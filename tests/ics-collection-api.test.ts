import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { userEventFromDraft } from "../src/lib/user-events";

const { getPublicCollectionServer, loadFeaturedCollection } = vi.hoisted(() => ({
  getPublicCollectionServer: vi.fn(),
  loadFeaturedCollection: vi.fn(),
}));

vi.mock("@/lib/collections-server", () => ({ getPublicCollectionServer }));
vi.mock("@/lib/featured-collections", async () => {
  const actual = await vi.importActual<typeof import("@/lib/featured-collections")>(
    "@/lib/featured-collections",
  );
  return { ...actual, loadFeaturedCollection };
});

import { GET as getCollection } from "../src/app/api/ics/collection/[handle]/[slug]/route";
import { GET as getFeatured } from "../src/app/api/ics/featured/[slug]/route";

const asianGames = {
  ...userEventFromDraft({ title: "Asian Games", date: "2026-09-19" }),
  id: "asian-games-2026-09-19",
  slug: "asian-games-2026-09-19",
};
const halloween = {
  ...userEventFromDraft({ title: "Halloween", date: "2026-10-31" }),
  id: "halloween-2026-10-31",
  slug: "halloween-2026-10-31",
};

const collectionRequest = new NextRequest(
  "http://localhost/api/ics/collection/ada/autumn-nights",
);
const collectionContext = {
  params: Promise.resolve({ handle: "ada", slug: "autumn-nights" }),
};
const featuredRequest = new NextRequest(
  "http://localhost/api/ics/featured/scream-this-month",
);
const featuredContext = {
  params: Promise.resolve({ slug: "scream-this-month" }),
};

beforeEach(() => vi.resetAllMocks());

describe("collection calendar endpoint", () => {
  it("returns 404 for an unknown handle or collection", async () => {
    getPublicCollectionServer.mockResolvedValue(null);
    const missing = await getCollection(collectionRequest, collectionContext);
    expect(missing.status).toBe(404);

    const badHandle = await getCollection(
      new NextRequest("http://localhost/api/ics/collection/ab/autumn-nights"),
      { params: Promise.resolve({ handle: "ab", slug: "autumn-nights" }) },
    );
    expect(badHandle.status).toBe(404);
    expect(getPublicCollectionServer).toHaveBeenCalledTimes(1);
  });

  it("returns 422 when nothing in the collection has a confirmed date", async () => {
    getPublicCollectionServer.mockResolvedValue({
      title: "Autumn nights",
      items: [{ ...asianGames, datePrecision: "year" }],
    });
    const result = await getCollection(collectionRequest, collectionContext);
    expect(result.status).toBe(422);
    expect(await result.text()).not.toContain("VEVENT");
  });

  it("returns a retryable 503 on database failure instead of a false 404", async () => {
    getPublicCollectionServer.mockRejectedValue(new Error("database"));
    const result = await getCollection(collectionRequest, collectionContext);
    expect(result.status).toBe(503);
    expect(result.headers.get("cache-control")).toBe("no-store");
  });

  it("returns one calendar with every dated countdown", async () => {
    getPublicCollectionServer.mockResolvedValue({
      title: "Autumn nights",
      items: [asianGames, halloween, { ...asianGames, id: "tba", datePrecision: "month" }],
    });
    const result = await getCollection(collectionRequest, collectionContext);
    expect(result.status).toBe(200);
    const body = await result.text();
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(body).toContain("X-WR-CALNAME:Autumn nights");
    expect(result.headers.get("content-disposition")).toContain("inline");
    expect(result.headers.get("content-disposition")).toContain("ada-autumn-nights.ics");
  });
});

describe("featured collection calendar endpoint", () => {
  it("returns 404 for an unknown editorial slug", async () => {
    const result = await getFeatured(
      new NextRequest("http://localhost/api/ics/featured/not-a-list"),
      { params: Promise.resolve({ slug: "not-a-list" }) },
    );
    expect(result.status).toBe(404);
    expect(loadFeaturedCollection).not.toHaveBeenCalled();
  });

  it("returns 422 when the list has no upcoming dated events", async () => {
    loadFeaturedCollection.mockResolvedValue({
      meta: { slug: "scream-this-month", title: "The best horror this month" },
      events: [],
    });
    const result = await getFeatured(featuredRequest, featuredContext);
    expect(result.status).toBe(422);
  });

  it("returns a retryable 503 when the catalog cannot be read", async () => {
    loadFeaturedCollection.mockRejectedValue(new Error("catalog"));
    const result = await getFeatured(featuredRequest, featuredContext);
    expect(result.status).toBe(503);
    expect(result.headers.get("cache-control")).toBe("no-store");
  });

  it("returns a calendar for a dated list", async () => {
    loadFeaturedCollection.mockResolvedValue({
      meta: { slug: "scream-this-month", title: "The best horror this month" },
      events: [halloween],
    });
    const result = await getFeatured(featuredRequest, featuredContext);
    expect(result.status).toBe(200);
    const body = await result.text();
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("The best horror this month");
    expect(result.headers.get("content-disposition")).toContain("scream-this-month.ics");
  });
});
