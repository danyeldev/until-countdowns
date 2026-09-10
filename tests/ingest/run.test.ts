import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Adapter, IngestEvent, Json, Unit } from "@/lib/ingest/types";
import { buildEvent } from "@/lib/ingest/normalize";
import { BudgetExceededError } from "@/lib/ingest/http";

/**
 * Runner behaviour against a fake database and a scripted adapter. Every rpc/update/insert is
 * recorded so the tests can assert the state machine: lease released on every path, cursor
 * written after each unit, `partial` on budget, no stale marking after lost units, backoff on
 * systemic failure, one `ingest_run` log line per run.
 */

type Call = { kind: string; args: unknown[] };
const calls: Call[] = [];
let stateRow: Record<string, unknown> | null = { cursor: null, pass_started_at: null, backoff_until: null, consecutive_failures: 0 };
let leaseToken: string | null = "lease-1";
let upsertResult = { inserted: 1, updated: 0, unchanged: 0, drifted: 0 };
let statePatches: Record<string, unknown>[] = [];

function fakeDb() {
  const chain = (table: string) => {
    const q: Record<string, unknown> = {};
    const self = () => q;
    Object.assign(q, {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data: table === "ingest_state" ? stateRow : null, error: null }),
      single: async () => ({ data: { id: 42 }, error: null }),
      insert: (row: Record<string, unknown>) => {
        calls.push({ kind: `insert:${table}`, args: [row] });
        return { ...q, select: () => ({ single: async () => ({ data: { id: 42 }, error: null }) }), then: (r: (v: unknown) => void) => r({ error: null }) };
      },
      update: (patch: Record<string, unknown>) => {
        calls.push({ kind: `update:${table}`, args: [patch] });
        if (table === "ingest_state") statePatches.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    });
    void self;
    return q;
  };
  return {
    from: (table: string) => chain(table),
    rpc: async (name: string, args: unknown) => {
      calls.push({ kind: `rpc:${name}`, args: [args] });
      if (name === "acquire_source_lease") return { data: leaseToken, error: null };
      if (name === "release_source_lease") return { data: null, error: null };
      if (name === "mark_stale_records") return { data: 3, error: null };
      if (name === "upsert_events") return { data: [upsertResult], error: null };
      return { data: null, error: null };
    },
  };
}

vi.mock("@/lib/ingest/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/ingest/db")>();
  return { ...mod, getDb: async () => fakeDb(), getLongDb: async () => fakeDb() };
});
vi.mock("@/lib/ingest/revalidate", () => ({ revalidateCatalog: async () => undefined }));

let scripted: Adapter;
vi.mock("@/lib/ingest/sources/index", () => ({
  loadAdapter: async () => scripted,
  isSource: () => true,
  listSources: () => [],
}));

type Step = { rows?: IngestEvent[]; throws?: unknown; sleepMs?: number };

function row(title: string, date: string) {
  return buildEvent({ title, date, category: "culture", source: "curated", regions: ["GLOBAL"], popularity: 40 });
}

function makeAdapter(steps: Step[], opts: { timeoutMs?: number } = {}): Adapter {
  const units: Unit[] = steps.map((_, i) => ({ key: `u${i}`, label: `unit ${i}`, after: { next: i + 1 } as Json }));
  let attemptsByUnit: Record<string, number> = {};
  const adapter: Adapter = {
    id: "fake",
    label: "Fake",
    rank: 5,
    cadence: "daily",
    isConfigured: () => true,
    limits: { concurrency: 1, minIntervalMs: 0, timeoutMs: opts.timeoutMs ?? 50, maxRetries: 0 },
    async plan(cursor) {
      const from = cursor && typeof cursor === "object" && !Array.isArray(cursor) ? Number((cursor as { next?: number }).next ?? 0) : 0;
      return { units: units.slice(from), done: true };
    },
    async run(unit) {
      const i = Number(unit.key.slice(1));
      attemptsByUnit[unit.key] = (attemptsByUnit[unit.key] ?? 0) + 1;
      const step = steps[i];
      if (step.sleepMs) await new Promise((r) => setTimeout(r, step.sleepMs));
      if (step.throws) throw step.throws;
      return step.rows ?? [];
    },
  };
  (adapter as unknown as { attempts: () => Record<string, number> }).attempts = () => attemptsByUnit;
  (adapter as unknown as { reset: () => void }).reset = () => {
    attemptsByUnit = {};
  };
  return adapter;
}

async function run(opts: Parameters<typeof import("@/lib/ingest/run").runSource>[1] = {}) {
  const { runSource } = await import("@/lib/ingest/run");
  return runSource("fake", { trigger: "manual", ...opts });
}

function rpcNames() {
  return calls.filter((c) => c.kind.startsWith("rpc:")).map((c) => c.kind.slice(4));
}

let logLines: string[] = [];

beforeEach(() => {
  calls.length = 0;
  statePatches = [];
  logLines = [];
  stateRow = { cursor: null, pass_started_at: null, backoff_until: null, consecutive_failures: 0 };
  leaseToken = "lease-1";
  upsertResult = { inserted: 1, updated: 0, unchanged: 0, drifted: 0 };
  vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    logLines.push(String(line));
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

function ingestRunLines() {
  return logLines.filter((l) => l.startsWith('{"evt":"ingest_run"')).map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe("runSource", () => {
  it("ok: cursor written after each unit, stale marking, lease released, one log line", async () => {
    scripted = makeAdapter([{ rows: [row("Alpha Event", "2027-01-01")] }, { rows: [row("Beta Event", "2027-02-01")] }]);
    const s = await run({ budgetMs: 10_000 });
    expect(s.status).toBe("ok");
    expect(s.units).toBe(2);
    expect(s.inserted).toBe(2);
    expect(s.cursor).toBeNull();
    const cursors = statePatches.filter((p) => "cursor" in p).map((p) => p.cursor);
    expect(cursors).toContainEqual({ next: 1 });
    expect(cursors).toContainEqual({ next: 2 });
    expect(cursors[cursors.length - 1]).toBeNull();
    expect(rpcNames()).toEqual(["acquire_source_lease", "upsert_events", "upsert_events", "mark_stale_records", "release_source_lease"]);
    const last = statePatches[statePatches.length - 1];
    expect(last.last_success_at).toBeTruthy();
    expect(last.pass_started_at).toBeNull();
    const lines = ingestRunLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ source: "fake", status: "ok", units: 2, inserted: 2 });
  });

  it("partial (budget): a unit running past the deadline keeps the cursor at the previous unit and releases the lease", async () => {
    scripted = makeAdapter([{ rows: [row("Alpha Event", "2027-01-01")] }, { sleepMs: 200, throws: new BudgetExceededError("http://x", 0) }, { rows: [row("Gamma Event", "2027-03-01")] }], {
      timeoutMs: 1_000,
    });
    const s = await run({ budgetMs: 400 }); // deadline = 400 - 100 = 300 ms
    expect(s.status).toBe("partial");
    expect(s.partialReason).toBe("budget");
    expect(s.units).toBe(2);
    expect(s.cursor).toEqual({ next: 1 }); // unit 1 is retried next run
    expect(rpcNames()).not.toContain("mark_stale_records");
    expect(rpcNames()[rpcNames().length - 1]).toBe("release_source_lease");
    const last = statePatches[statePatches.length - 1];
    expect(last).toMatchObject({ cursor: { next: 1 }, consecutive_failures: 0, backoff_until: null });
    expect(last.pass_started_at).toBeTruthy();
    expect(ingestRunLines()).toHaveLength(1);
    expect(ingestRunLines()[0]).toMatchObject({ status: "partial", reason: "budget" });
  });

  it("partial (budget) with no progress: the unit is skipped so the pass advances", async () => {
    scripted = makeAdapter([{ throws: new BudgetExceededError("http://x", 0) }, { rows: [] }], { timeoutMs: 1_000 });
    const s = await run({ budgetMs: 400 });
    expect(s.status).toBe("partial");
    expect(s.cursor).toEqual({ next: 1 });
    expect(s.errors[0].message).toMatch(/exceeded the whole budget/);
  });

  it("a slow unit is stopped by the deadline instead of overrunning it", async () => {
    // The adapter uses ctx.http; the fake fetch never resolves until aborted.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "TimeoutError" })));
      });
    });
    scripted = makeAdapter([{ rows: [row("Alpha Event", "2027-01-01")] }, { rows: [] }], { timeoutMs: 5_000 });
    scripted.run = async (unit, ctx) => {
      if (unit.key === "u0") return [row("Alpha Event", "2027-01-01")];
      await ctx.http.fetchText("https://example.test/slow");
      return [];
    };
    const t = Date.now();
    const s = await run({ budgetMs: 3_000 }); // deadline at 2 250 ms; the 5 s request timeout is clamped to what is left
    const elapsed = Date.now() - t;
    expect(elapsed).toBeGreaterThan(1_500);
    expect(elapsed).toBeLessThan(4_500);
    expect(s.status).toBe("partial");
    expect(s.partialReason).toBe("budget");
    expect(s.cursor).toEqual({ next: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("lost units: unit failure after 2 attempts → partial, cursor advanced, no stale marking", async () => {
    scripted = makeAdapter([{ throws: new Error("boom") }, { rows: [row("Beta Event", "2027-02-01")] }]);
    const s = await run({ budgetMs: 10_000 });
    expect(s.status).toBe("partial");
    expect(s.partialReason).toBe("lost-units");
    expect(s.cursor).toBeNull(); // plan finished: start over next time
    expect((scripted as unknown as { attempts: () => Record<string, number> }).attempts().u0).toBe(2);
    expect(rpcNames()).not.toContain("mark_stale_records");
    expect(rpcNames()).toContain("release_source_lease");
    expect(s.errors.map((e) => e.unit)).toContain("u0");
  });

  it("systemic: 3 consecutive failures → error, backoff grows with consecutive_failures", async () => {
    scripted = makeAdapter([{ throws: new Error("x") }, { throws: new Error("x") }, { throws: new Error("x") }, { rows: [] }]);
    stateRow = { cursor: null, pass_started_at: null, backoff_until: null, consecutive_failures: 2 };
    const s = await run({ budgetMs: 10_000 });
    expect(s.status).toBe("error");
    const last = statePatches[statePatches.length - 1];
    expect(last.consecutive_failures).toBe(3);
    const backoffMs = Date.parse(String(last.backoff_until)) - Date.now();
    expect(backoffMs).toBeGreaterThan(3.9 * 3_600_000); // 60 min × 2^(3-1)
    expect(backoffMs).toBeLessThanOrEqual(4 * 3_600_000);
    expect(rpcNames()).toContain("release_source_lease");
    expect(ingestRunLines()[0]).toMatchObject({ status: "error", errors: 4 });
  });

  it("skipped (lease held) writes an ingest_runs row and never touches state", async () => {
    scripted = makeAdapter([{ rows: [] }]);
    leaseToken = null;
    const s = await run({ budgetMs: 10_000 });
    expect(s.status).toBe("skipped");
    expect(s.reason).toBe("leased");
    const inserts = calls.filter((c) => c.kind === "insert:ingest_runs");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].args[0]).toMatchObject({ status: "skipped", source: "fake" });
    expect(statePatches).toHaveLength(0);
    expect(rpcNames()).not.toContain("release_source_lease");
    expect(ingestRunLines()[0]).toMatchObject({ status: "skipped", reason: "leased" });
  });

  it("skipped (backoff) unless forced", async () => {
    scripted = makeAdapter([{ rows: [] }]);
    stateRow = { cursor: null, pass_started_at: null, backoff_until: new Date(Date.now() + 60_000).toISOString(), consecutive_failures: 1 };
    expect((await run({ budgetMs: 10_000 })).reason).toBe("backoff");
    expect((await run({ budgetMs: 10_000, force: true })).status).toBe("ok");
  });

  it("dry run: no writes, no lease, counts under `validated`", async () => {
    scripted = makeAdapter([{ rows: [row("Alpha Event", "2027-01-01"), { ...row("Bad Event", "2027-01-01"), category: "nope" } as unknown as IngestEvent] }]);
    const s = await run({ budgetMs: 10_000, dryRun: true });
    expect(s.status).toBe("ok");
    expect(s.validated).toBe(1);
    expect(s.invalid).toBe(1);
    expect(s.inserted).toBe(0);
    expect(s.sample?.length).toBe(1);
    expect(calls.filter((c) => c.kind.startsWith("insert:") || c.kind.startsWith("update:"))).toHaveLength(0);
    expect(rpcNames()).toEqual([]);
    expect(ingestRunLines()[0]).toMatchObject({ dry_run: true, validated: 1, inserted: 0 });
  });
});
