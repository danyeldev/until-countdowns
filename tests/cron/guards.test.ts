import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { assertCron, cronBudget, cronTrigger } from "@/lib/cron";

afterEach(() => vi.unstubAllEnvs());
const request = (headers: Record<string, string> = {}) => new NextRequest("https://until.example/api/cron/dispatch", { headers });

describe("cron request guards", () => {
  it("fails closed when no secret is configured and prevents response caching", () => {
    vi.stubEnv("CRON_SECRET", "");
    const result = assertCron(request());
    expect(result?.status).toBe(503);
    expect(result?.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects absent or incorrect credentials and accepts the configured bearer", () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    expect(assertCron(request())?.status).toBe(401);
    expect(assertCron(request({ authorization: "Bearer wrong" }))?.status).toBe(401);
    expect(assertCron(request({ authorization: "Bearer test-secret" }))).toBeNull();
  });
  it("recognizes the scheduler header without treating it as authentication", () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    const scheduled = request({ "x-vercel-cron-schedule": "*/15 * * * *" });
    expect(cronTrigger(scheduled)).toBe("cron");
    expect(assertCron(scheduled)?.status).toBe(401);
    expect(cronTrigger(request())).toBe("manual");
  });
  it("clamps user/env budgets and rejects non-finite values", () => {
    expect(cronBudget("9000000", "1")).toBe(240_000);
    expect(cronBudget(null, "90000")).toBe(90_000);
    expect(cronBudget("Infinity", "NaN")).toBe(240_000);
    expect(cronBudget("1500.9", undefined)).toBe(1500);
  });
});
