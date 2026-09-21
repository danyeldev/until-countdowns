import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  cache: new Map<string, { value: number; tags: string[] }>(),
  cached: vi.fn(),
  revalidateTag: vi.fn(),
  anonClient: vi.fn(),
  createAuthServerClient: vi.fn(),
  getAuthClaims: vi.fn(),
  isAuthConfigured: vi.fn(),
  read: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({ cached: mocks.cached }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock("@/lib/db/client", () => ({ anonClient: mocks.anonClient }));
vi.mock("@/lib/auth/server", () => ({
  createAuthServerClient: mocks.createAuthServerClient,
  getAuthClaims: mocks.getAuthClaims,
}));
vi.mock("@/lib/auth/env", () => ({ isAuthConfigured: mocks.isAuthConfigured }));

import { GET, POST } from "@/app/api/hype/route";

function readRequest(eventKey: string, headers?: HeadersInit) {
  return new NextRequest(`https://until.day/api/hype?eventKey=${encodeURIComponent(eventKey)}`, { headers });
}

function writeRequest(eventKey = "halloween-2026", kind = "visit", headers?: HeadersInit) {
  return new NextRequest("https://until.day/api/hype", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ eventKey, kind }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.cache.clear();
  mocks.isAuthConfigured.mockReturnValue(true);
  mocks.getAuthClaims.mockResolvedValue(null);
  mocks.read.mockResolvedValue({ data: { points: 8 }, error: null });
  mocks.anonClient.mockReturnValue({
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, key: string) => ({
          maybeSingle: () => mocks.read(table, columns, column, key),
        }),
      }),
    }),
  });
  mocks.createAuthServerClient.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { points: 9, added: 1, kind: "visit" }, error: null });
  mocks.cached.mockImplementation((fn, keyParts, options) => async () => {
    const key = JSON.stringify(keyParts);
    const existing = mocks.cache.get(key);
    if (existing) return existing.value;
    const value = await fn();
    mocks.cache.set(key, { value, tags: options.tags });
    return value;
  });
  mocks.revalidateTag.mockImplementation((tag) => {
    for (const [key, entry] of mocks.cache) {
      if (entry.tags.includes(tag)) mocks.cache.delete(key);
    }
  });
});

describe("public hype reads", () => {
  it("shares only the anonymous public total, even when the request has auth cookies", async () => {
    const response = await GET(readRequest("halloween-2026", {
      cookie: "sb-project-auth-token=private-session; until_hype=v:12345678",
      authorization: "Bearer private-token",
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ points: 8, added: 0, kind: null });
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=60");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(mocks.read).toHaveBeenCalledWith("event_hype", "points", "event_key", "halloween-2026");
    expect(mocks.createAuthServerClient).not.toHaveBeenCalled();
    expect(mocks.getAuthClaims).not.toHaveBeenCalled();
  });

  it("reuses the database read for one event without mixing different events", async () => {
    mocks.read.mockResolvedValueOnce({ data: { points: 8 }, error: null });
    mocks.read.mockResolvedValueOnce({ data: { points: 30 }, error: null });
    expect((await (await GET(readRequest("halloween-2026"))).json()).points).toBe(8);
    expect((await (await GET(readRequest("halloween-2026"))).json()).points).toBe(8);
    expect((await (await GET(readRequest("christmas-2026"))).json()).points).toBe(30);
    expect(mocks.read).toHaveBeenCalledTimes(2);
    expect(mocks.cached).toHaveBeenCalledWith(expect.any(Function), ["hype", "points", "halloween-2026"], {
      tags: ["hype:halloween-2026"], revalidate: 60,
    });
  });

  it("rejects malformed keys without any database read", async () => {
    const response = await GET(readRequest("private.or.eq.secret"));
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("does not cache database errors as zero points", async () => {
    mocks.read.mockResolvedValueOnce({ data: null, error: { message: "internal database details" } });
    const failed = await GET(readRequest("halloween-2026"));
    expect(failed.status).toBe(503);
    expect(failed.headers.get("cache-control")).toBe("private, no-store");
    expect(await failed.json()).toEqual({ error: "Could not load that." });
    const retry = await GET(readRequest("halloween-2026"));
    expect(retry.status).toBe(200);
    expect((await retry.json()).points).toBe(8);
    expect(mocks.read).toHaveBeenCalledTimes(2);
  });
});

describe("hype writes", () => {
  it("returns the authoritative write privately and expires only the changed event", async () => {
    await GET(readRequest("halloween-2026"));
    await GET(readRequest("christmas-2026"));
    mocks.getAuthClaims.mockResolvedValue({ sub: "11111111-1111-1111-1111-111111111111" });
    const response = await POST(writeRequest());
    expect(await response.json()).toEqual({ points: 9, added: 1, kind: "visit" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith("record_event_hype", {
      p_event_key: "halloween-2026", p_kind: "visit", p_visitor_id: "u:11111111-1111-1111-1111-111111111111",
    });
    expect(mocks.revalidateTag).toHaveBeenCalledExactlyOnceWith("hype:halloween-2026", { expire: 0 });
    mocks.read.mockResolvedValue({ data: { points: 9 }, error: null });
    expect((await (await GET(readRequest("halloween-2026"))).json()).points).toBe(9);
    expect((await (await GET(readRequest("christmas-2026"))).json()).points).toBe(8);
    expect(mocks.read).toHaveBeenCalledTimes(3);
  });

  it("preserves anonymous visitor cookies and avoids invalidation for duplicate actions", async () => {
    mocks.rpc.mockResolvedValue({ data: { points: 8, added: 0, kind: "visit" }, error: null });
    const response = await POST(writeRequest());
    expect(response.headers.get("set-cookie")).toContain("until_hype=v%3A");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("keeps bot visits read-only and reuses the public read cache", async () => {
    await GET(readRequest("halloween-2026"));
    const response = await POST(writeRequest("halloween-2026", "visit", { "user-agent": "Googlebot" }));
    expect(await response.json()).toEqual({ points: 8, added: 0, kind: "visit" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.getAuthClaims).not.toHaveBeenCalled();
    expect(mocks.read).toHaveBeenCalledTimes(1);
  });

  it("does not invalidate successful reads when a write fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    const response = await POST(writeRequest());
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});
