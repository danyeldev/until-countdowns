import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttp, HttpError, isBudgetExceeded } from "@/lib/ingest/http";

afterEach(() => vi.restoreAllMocks());

function neverResolves(): typeof fetch {
  return (_url, init) =>
    new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "TimeoutError" })));
    });
}

describe("budget-aware http", () => {
  it("does not wait in the host queue beyond the run deadline", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("ok"));
    const http = createHttp({ minIntervalMs: 60_000, remainingMs: () => 10_000 });
    await http.fetchText("https://spacing-budget.example.test/first");
    await expect(http.fetchText("https://spacing-budget.example.test/second")).rejects.toSatisfy(isBudgetExceeded);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not shorten a provider's long Retry-After to an early retry", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("busy", { status: 429, headers: { "retry-after": "300" } }));
    const http = createHttp({ maxRetries: 3, remainingMs: () => 600_000 });
    await expect(http.fetchText("https://example.test/limited")).rejects.toBeInstanceOf(HttpError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("classifies a slow response body as budget exhaustion after headers arrive", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => new Response(new ReadableStream({
      start(controller) {
        init?.signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
      },
    })));
    const deadline = Date.now() + 1_200;
    const http = createHttp({ timeoutMs: 30_000, remainingMs: () => deadline - Date.now() });
    await expect(http.fetchText("https://example.test/body")).rejects.toSatisfy(isBudgetExceeded);
  });

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
