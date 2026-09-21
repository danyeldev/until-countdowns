import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const fakes = vi.hoisted(() => ({ rpc: vi.fn(), invalidate: vi.fn(), clientError: false }));
vi.mock("@/lib/cache", () => ({
  invalidateTags: fakes.invalidate,
  TAG_EVENTS: "events",
  TAG_STATS: "stats",
  TAG_CATALOG_LISTS: "catalog-lists",
}));
vi.mock("@/lib/ingest/db", () => ({
  FINALIZE_TIMEOUT_MS: 110_000,
  getDb: async () => {
    if (fakes.clientError) throw new Error("missing database config");
    return { rpc: fakes.rpc, from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }) };
  },
  getLongDb: async () => ({ rpc: fakes.rpc }),
}));
import { GET } from "@/app/api/cron/finalize/route";
const request = (authorized = true) => new NextRequest("https://until.example/api/cron/finalize", { headers: authorized ? { authorization: "Bearer test-secret" } : {} });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.stubEnv("INGEST_ENABLED", "true");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  fakes.clientError = false;
  fakes.rpc.mockImplementation(async (name) => ({ data: name === "acquire_source_lease" ? "lease-1" : null, error: null }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("finalize route", () => {
  it("does no database work when unauthorized or disabled", async () => {
    expect((await GET(request(false))).status).toBe(401);
    vi.stubEnv("INGEST_ENABLED", "false");
    expect(await (await GET(request())).json()).toMatchObject({ skipped: true });
    expect(fakes.rpc).not.toHaveBeenCalled();
  });
  it("returns a structured error for missing database configuration", async () => {
    fakes.clientError = true;
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false, error: "missing database config" });
  });
  it("releases its lease even if finalization fails", async () => {
    fakes.rpc.mockImplementation(async (name) => ({ data: name === "acquire_source_lease" ? "lease-1" : null, error: name === "finalize_catalog" ? { message: "RPC timed out" } : null }));
    expect((await GET(request())).status).toBe(500);
    expect(fakes.rpc).toHaveBeenLastCalledWith("release_source_lease", { p_source: "__finalize", p_token: "lease-1" });
    expect(fakes.invalidate).not.toHaveBeenCalled();
  });
  it("skips overlapping finalizations", async () => {
    fakes.rpc.mockResolvedValue({ data: null, error: null });
    expect(await (await GET(request())).json()).toMatchObject({ skipped: true, reason: "leased" });
    expect(fakes.rpc).toHaveBeenCalledOnce();
  });
  it("refreshes aggregates without invalidating every detail and hub page", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ revalidated: ["stats"] });
    expect(fakes.invalidate).toHaveBeenCalledExactlyOnceWith(["stats"]);
    expect(fakes.rpc).toHaveBeenLastCalledWith("release_source_lease", { p_source: "__finalize", p_token: "lease-1" });
  });
});
