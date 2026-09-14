import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { eventsByIds } = vi.hoisted(() => ({ eventsByIds: vi.fn() }));
vi.mock("@/lib/catalog", () => ({ eventsByIds }));
import { GET } from "../src/app/api/events/saved/route";
const id = "11111111-1111-4111-8111-111111111111";
const request = (ids: string) =>
  new NextRequest(
    `http://localhost/api/events/saved?ids=${encodeURIComponent(ids)}`,
  );
beforeEach(() => {
  vi.clearAllMocks();
});
describe("saved catalog lookup", () => {
  it("validates IDs before a database read", async () => {
    for (const invalid of [
      "bad.id",
      "mine-personal-2027-01-01",
      "share-payload",
      "id.eq.secret",
      Array.from(
        { length: 51 },
        (_, n) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`,
      ).join(","),
    ]) {
      expect((await GET(request(invalid))).status).toBe(400);
    }
    expect(eventsByIds).not.toHaveBeenCalled();
  });
  it("returns an empty list without reading the database", async () => {
    expect(await (await GET(request(""))).json()).toEqual({ items: [] });
    expect(eventsByIds).not.toHaveBeenCalled();
  });
  it("deduplicates catalog IDs, omits unattributed summaries and keeps responses private", async () => {
    eventsByIds.mockResolvedValue([
      {
        id,
        title: "A date",
        description: "Original",
        summary: "Wikipedia prose",
      },
    ]);
    const response = await GET(request(`${id},${id}`));
    expect(eventsByIds).toHaveBeenCalledWith([id]);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).items[0]).not.toHaveProperty("summary");
  });
  it("refreshes the immutable slug IDs used by the database", async () => {
    const originalId = "september-equinox-2026-09-22";
    eventsByIds.mockResolvedValue([{ id: originalId, slug: "september-equinox-2026-09-23" }]);
    const response = await GET(request(originalId));
    expect(response.status).toBe(200);
    expect(eventsByIds).toHaveBeenCalledWith([originalId]);
    expect((await response.json()).items[0].slug).toBe("september-equinox-2026-09-23");
  });

  it("distinguishes unavailable catalog from removed bookmarks", async () => {
    eventsByIds.mockRejectedValue(new Error("secret database failure"));
    const response = await GET(request(id));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
