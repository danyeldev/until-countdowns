import { describe, expect, it } from "vitest";
import { sourceSchedule, type SourceState } from "@/lib/ingest/schedule";
import type { SourceEntry } from "@/lib/ingest/sources/index";

const NOW = Date.parse("2026-09-14T12:00:00Z");
const hour = 3_600_000;
const iso = (hoursAgo = 0) => new Date(NOW - hoursAgo * hour).toISOString();
const source = (id: string, cadence: SourceEntry["cadence"] = "daily"): SourceEntry => ({ id, label: id, rank: 1, cadence, load: async () => { throw new Error("pure scheduler never loads adapters"); } });
const state = (id: string, patch: Partial<SourceState> = {}): SourceState => ({ source: id, cursor: null, pass_started_at: null, last_success_at: iso(48), consecutive_failures: 0, backoff_until: null, lease_expires_at: null, updated_at: iso(48), ...patch });

describe("source dispatch scheduling", () => {
  it("runs only due sources and respects the normal cadence", () => {
    const entries = sourceSchedule([source("daily"), source("weekly", "weekly")], [state("daily"), state("weekly")], NOW);
    expect(entries.find((entry) => entry.id === "daily")?.due).toBe(true);
    expect(entries.find((entry) => entry.id === "weekly")?.due).toBe(false);
  });
  it("resumes an unfinished monthly pass on the next tick", () => {
    const [entry] = sourceSchedule([source("monthly", "monthly")], [state("monthly", { cursor: { offset: 25 }, last_success_at: iso(1) })], NOW);
    expect(entry).toMatchObject({ due: true, pending: true, health: "resuming" });
  });
  it("never dispatches a leased or backed-off source", () => {
    const entries = sourceSchedule([source("leased"), source("backoff")], [state("leased", { lease_expires_at: iso(-1) }), state("backoff", { backoff_until: iso(-1) })], NOW);
    expect(entries.every((entry) => !entry.due)).toBe(true);
  });
  it("rotates overdue sources by last attempt to avoid starving a source behind a slow pass", () => {
    const entries = sourceSchedule([source("slow"), source("waiting"), source("new")], [state("slow", { updated_at: iso(0), cursor: { page: 10 } }), state("waiting", { updated_at: iso(1) })], NOW);
    expect(entries.map((entry) => entry.id)).toEqual(["new", "waiting", "slow"]);
  });
  it("keeps Launch Library at six hours while preserving its daily health tolerance", () => {
    const [entry] = sourceSchedule([source("ll2")], [state("ll2", { last_success_at: iso(7) })], NOW);
    expect(entry).toMatchObject({ due: true, health: "healthy" });
  });
});
