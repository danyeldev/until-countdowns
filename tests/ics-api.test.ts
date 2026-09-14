import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { userEventFromDraft } from "../src/lib/user-events";
const { getEventStrict, resolveSlugAliasStrict } = vi.hoisted(() => ({
  getEventStrict: vi.fn(),
  resolveSlugAliasStrict: vi.fn(),
}));
vi.mock("@/lib/catalog", () => ({ getEventStrict, resolveSlugAliasStrict }));
import { GET } from "../src/app/api/ics/[slug]/route";
const event = {
  ...userEventFromDraft({ title: "Future launch", date: "2027-01-01" }),
  id: "future-launch-2027-01-01",
  slug: "future-launch-2027-01-01",
};
const request = new NextRequest(
  "http://localhost/api/ics/future-launch-2027-01-01",
);
const context = { params: Promise.resolve({ slug: event.slug }) };
beforeEach(() => vi.resetAllMocks());
describe("calendar endpoint", () => {
  it("returns 422 for a known approximate date", async () => {
    getEventStrict.mockResolvedValue({ ...event, datePrecision: "year" });
    const result = await GET(request, context);
    expect(result.status).toBe(422);
    expect(await result.text()).not.toContain("VEVENT");
  });
  it("returns a retryable503 on database failure instead of a false404", async () => {
    getEventStrict.mockRejectedValue(new Error("database"));
    const result = await GET(request, context);
    expect(result.status).toBe(503);
    expect(result.headers.get("cache-control")).toBe("no-store");
  });
  it("returns a calendar for a dated event", async () => {
    getEventStrict.mockResolvedValue(event);
    const result = await GET(request, context);
    expect(result.status).toBe(200);
    expect(await result.text()).toContain("BEGIN:VEVENT");
  });
});
