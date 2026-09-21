import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const snapshot = (points: number, added = 0) => Response.json({ points, added, kind: added ? "visit" : null });

describe("hype client request sharing", () => {
  it("deduplicates simultaneous and recent reads without sending session cookies", async () => {
    const { fetchHype } = await import("@/lib/hype-client");
    fetchMock.mockResolvedValue(snapshot(12));
    expect(await Promise.all([fetchHype("halloween-2026"), fetchHype("halloween-2026")])).toEqual([12, 12]);
    expect(await fetchHype("halloween-2026")).toBe(12);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/hype?eventKey=halloween-2026", { credentials: "omit" });
  });

  it("refreshes expired entries and keeps separate events independent", async () => {
    const { fetchHype } = await import("@/lib/hype-client");
    fetchMock.mockResolvedValueOnce(snapshot(12)).mockResolvedValueOnce(snapshot(4)).mockResolvedValueOnce(snapshot(18));
    expect(await fetchHype("halloween-2026")).toBe(12);
    expect(await fetchHype("christmas-2026")).toBe(4);
    vi.advanceTimersByTime(60_001);
    expect(await fetchHype("halloween-2026")).toBe(18);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not cache a failed request", async () => {
    const { fetchHype } = await import("@/lib/hype-client");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(snapshot(12));
    expect(await fetchHype("halloween-2026")).toBe(0);
    expect(await fetchHype("halloween-2026")).toBe(12);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps writes authenticated and uses their fresh totals on subsequent reads", async () => {
    const { fetchHype, recordHype } = await import("@/lib/hype-client");
    fetchMock.mockResolvedValueOnce(snapshot(13, 1)).mockResolvedValueOnce(snapshot(12));
    expect(await recordHype("halloween-2026", "visit")).toEqual({ points: 13, added: 1, kind: "visit" });
    expect(fetchMock).toHaveBeenCalledWith("/api/hype", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventKey: "halloween-2026", kind: "visit" }),
    });
    expect(await fetchHype("halloween-2026")).toBe(13);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_001);
    expect(await fetchHype("halloween-2026")).toBe(13);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not let an older in-flight read undo a completed write", async () => {
    const { fetchHype, recordHype } = await import("@/lib/hype-client");
    let finishRead!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { finishRead = resolve; }));
    const read = fetchHype("halloween-2026");
    fetchMock.mockResolvedValueOnce(snapshot(20, 1));
    await recordHype("halloween-2026", "visit");
    finishRead(snapshot(12));
    expect(await read).toBe(20);
    expect(await fetchHype("halloween-2026")).toBe(20);
  });
});
