import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const fakes = vi.hoisted(() => ({ run: vi.fn(), load: vi.fn(), states: [] as unknown[], query: vi.fn() }));
vi.mock("@/lib/ingest/db", () => ({ getDb: async () => ({ from: () => ({ select: fakes.query }) }) }));
vi.mock("@/lib/ingest/sources/index", () => ({
  CADENCE_MS: { daily: 86_400_000 },
  listSources: () => ["alpha", "beta"].map((id) => ({ id, cadence: "daily", rank: 1, label: id })),
  loadAdapter: fakes.load,
}));
vi.mock("@/lib/ingest/run", () => ({ runSource: fakes.run }));
import { GET } from "@/app/api/cron/dispatch/route";

const request = (query = "", authorized = true) => new NextRequest(`https://until.example/api/cron/dispatch${query}`, { headers: authorized ? { authorization: "Bearer test-secret", "x-vercel-cron-schedule": "*/15 * * * *" } : {} });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.stubEnv("INGEST_ENABLED", "true");
  fakes.states = [];
  fakes.query.mockImplementation(async () => ({ data: fakes.states, error: null }));
  fakes.load.mockResolvedValue({ isConfigured: () => true });
  fakes.run.mockImplementation(async (source) => ({ source, status: "ok" }));
});
afterEach(() => vi.unstubAllEnvs());

describe("cron dispatcher", () => {
  it("does not inspect or run sources without authorization", async () => {
    expect((await GET(request("", false))).status).toBe(401);
    expect(fakes.query).not.toHaveBeenCalled();
    expect(fakes.run).not.toHaveBeenCalled();
  });
  it("skips disabled providers and passes the dry-run flag into one bounded source", async () => {
    fakes.load.mockImplementation(async (source) => ({ isConfigured: () => source !== "alpha" }));
    const response = await GET(request("?dry=1&budget=999999"));
    expect(await response.json()).toMatchObject({ dispatched: "beta", disabled: ["alpha"] });
    expect(fakes.run).toHaveBeenCalledExactlyOnceWith("beta", expect.objectContaining({ dryRun: true, trigger: "cron" }));
    expect(fakes.run.mock.calls[0][1].budgetMs).toBeLessThanOrEqual(240_000);
  });
  it("moves to the next due source after a concurrent invocation wins its lease", async () => {
    fakes.run.mockResolvedValueOnce({ status: "skipped", reason: "leased" }).mockResolvedValueOnce({ status: "ok" });
    expect(await (await GET(request())).json()).toMatchObject({ dispatched: "beta" });
    expect(fakes.run).toHaveBeenCalledTimes(2);
  });
  it("returns a failed source as HTTP 500 for operations visibility", async () => {
    fakes.run.mockResolvedValue({ status: "error", errors: [{ message: "provider down" }] });
    expect((await GET(request())).status).toBe(500);
  });
});
