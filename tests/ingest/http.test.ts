import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttp, isBudgetExceeded } from "@/lib/ingest/http";

afterEach(() => vi.restoreAllMocks());

function neverResolves(): typeof fetch {
  return (_url, init) =>
    new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "TimeoutError" })));
    });
}

describe("budget-aware http", () => {
  it("refuses to start a request with (almost) no budget left", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(neverResolves());
    const http = createHttp({ timeoutMs: 5_000, maxRetries: 3, remainingMs: () => 500 });
    await expect(http.fetchText("https://example.test/x")).rejects.toSatisfy(isBudgetExceeded);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("clamps the timeout to the remaining budget and reports the abort as budget exhaustion", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(neverResolves());
    const deadline = Date.now() + 1_200;
    const http = createHttp({ timeoutMs: 30_000, maxRetries: 3, remainingMs: () => Math.max(0, deadline - Date.now()) });
    const t = Date.now();
    await expect(http.fetchText("https://example.test/x")).rejects.toSatisfy(isBudgetExceeded);
    expect(Date.now() - t).toBeLessThan(3_000);
  });
  it("does not retry a 503 when the wait would not fit the budget", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("busy", { status: 503, headers: { "retry-after": "30" } }));
    const http = createHttp({ timeoutMs: 5_000, maxRetries: 3, remainingMs: () => 5_000 });
    await expect(http.fetchText("https://example.test/x")).rejects.toSatisfy(isBudgetExceeded);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
  it("still retries and succeeds when the budget allows", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("busy", { status: 503, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const http = createHttp({ timeoutMs: 5_000, maxRetries: 3, remainingMs: () => 60_000 });
    await expect(http.fetchText("https://example.test/x")).resolves.toBe("ok");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
