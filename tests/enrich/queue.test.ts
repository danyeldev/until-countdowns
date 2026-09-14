import { describe, expect, it, vi } from "vitest";
import { previewJobs, releaseJob } from "@/lib/enrich/jobs";
import type { Db } from "@/lib/ingest/db";

function database() {
  const calls: Array<[string, ...unknown[]]> = [];
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "update", "eq", "lte", "order", "limit"]) {
    chain[method] = (...args: unknown[]) => { calls.push([method, ...args]); return chain; };
  }
  chain.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null });
  const rpc = vi.fn();
  return { db: { from: () => chain, rpc } as unknown as Db, calls, rpc };
}

describe("queue operations", () => {
  it("previews due pending jobs with a SELECT and never invokes the claim RPC", async () => {
    const { db, calls, rpc } = database();
    await expect(previewJobs(db, "image", 10)).resolves.toEqual([]);
    expect(calls).toContainEqual(["eq", "status", "pending"]);
    expect(calls).toContainEqual(["eq", "kind", "image"]);
    expect(calls).toContainEqual(["limit", 10]);
    expect(calls.some(([method]) => method === "update")).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("refunds only the exact pending claim that this worker owns", async () => {
    const { db, calls } = database();
    await releaseJob(db, { id: 42, kind: "image", event_id: "event", attempts: 3, last_error: null, next_attempt_at: "2026-09-14T12:30:00Z" });
    expect(calls).toContainEqual(["eq", "id", 42]);
    expect(calls).toContainEqual(["eq", "attempts", 3]);
    expect(calls).toContainEqual(["eq", "next_attempt_at", "2026-09-14T12:30:00Z"]);
    expect(calls).toContainEqual(["eq", "status", "pending"]);
    expect(calls.find(([method]) => method === "update")?.[1]).toMatchObject({ attempts: 2 });
  });
});
