import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fakes = vi.hoisted(() => ({
  claim: vi.fn(), preview: vi.fn(), release: vi.fn(), finish: vi.fn(), retry: vi.fn(),
  enrich: vi.fn(), remaining: 200_000, events: [] as Record<string, unknown>[], writes: vi.fn(), readError: null as string | null,
}));
vi.mock("@/lib/ingest/db", () => ({
  errorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
  getDb: async () => ({ from: () => ({
    select: () => ({
      in: async () => ({ data: fakes.events, error: fakes.readError ? { message: fakes.readError } : null }),
      eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
    }),
    update: fakes.writes,
  }) }),
}));
vi.mock("@/lib/enrich/jobs", () => ({
  claimJobs: fakes.claim, previewJobs: fakes.preview, releaseJob: fakes.release, finishJob: fakes.finish, retryJob: fakes.retry,
}));
vi.mock("@/lib/enrich/context", () => ({ makeContext: () => ({ budget: { remainingMs: () => fakes.remaining } }) }));
vi.mock("@/lib/enrich/wikipedia", () => ({ enrichSummary: fakes.enrich }));
vi.mock("@/lib/enrich/images/process", () => ({}));
vi.mock("@/lib/enrich/images/resolve", () => ({}));
vi.mock("@/lib/enrich/recheck", () => ({ RECHECK_LIMIT: 25 }));

import { runEnrichment } from "@/lib/enrich/run";

const jobs = [
  { id: 1, event_id: "first", kind: "wikipedia_summary", attempts: 1, last_error: null },
  { id: 2, event_id: "second", kind: "wikipedia_summary", attempts: 3, last_error: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  fakes.remaining = 200_000;
  fakes.readError = null;
  fakes.events = jobs.map((job) => ({ id: job.event_id, slug: job.event_id, external_ids: {}, title: job.event_id }));
  fakes.claim.mockResolvedValue(jobs);
  fakes.preview.mockResolvedValue(jobs);
  fakes.release.mockResolvedValue(undefined);
  fakes.finish.mockResolvedValue(undefined);
  fakes.enrich.mockResolvedValue({ status: "skipped", reason: "enough description" });
});
afterEach(() => vi.restoreAllMocks());

const options = { kinds: ["wikipedia_summary" as const], limit: 60, budgetMs: 240_000, dryRun: false };

describe("enrichment worker safety", () => {
  it("a dry run inspects the queue without claiming, settling, or changing live jobs", async () => {
    const result = await runEnrichment({ ...options, dryRun: true });
    expect(result).toMatchObject({ ok: true, dry: true, claimed: 0, inspected: 2, skipped: 2, deferred: 0 });
    expect(fakes.preview).toHaveBeenCalledOnce();
    expect(fakes.claim).not.toHaveBeenCalled();
    expect(fakes.finish).not.toHaveBeenCalled();
    expect(fakes.release).not.toHaveBeenCalled();
    expect(fakes.writes).not.toHaveBeenCalled();
  });

  it("refunds untouched jobs when the worker reaches its budget", async () => {
    fakes.enrich.mockImplementationOnce(async () => {
      fakes.remaining = 0;
      return { status: "skipped", reason: "enough description" };
    });
    const result = await runEnrichment(options);
    expect(result).toMatchObject({ claimed: 2, skipped: 1, deferred: 1, budget_exhausted: true });
    expect(fakes.release).toHaveBeenCalledExactlyOnceWith(expect.anything(), jobs[1]);
    expect(fakes.finish).toHaveBeenCalledExactlyOnceWith(expect.anything(), 1, "skipped", "enough description");
  });

  it("returns claimed work if loading its events fails", async () => {
    fakes.readError = "database unavailable";
    const result = await runEnrichment(options);
    expect(result).toMatchObject({ ok: false, failed: 1, deferred: 2 });
    expect(result.errors[0]).toContain("database unavailable");
    expect(fakes.release).toHaveBeenCalledTimes(2);
    expect(fakes.enrich).not.toHaveBeenCalled();
  });

  it("reports an unknown manual slug as a failure", async () => {
    const result = await runEnrichment({ ...options, slug: "missing" });
    expect(result).toMatchObject({ ok: false, failed: 1, claimed: 0 });
    expect(result.errors).toEqual(["slug not found: missing"]);
  });
});
