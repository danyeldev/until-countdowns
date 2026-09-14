import { CADENCE_MS, type SourceEntry } from "./sources/index";
import type { Json } from "@/lib/db/database.types";

// Launch times move more often than the registry's daily freshness tolerance. Preserve the
// existing six-hour refresh without spending the public API's small quota on hourly passes.
const REFRESH_MS: Record<string, number> = { ll2: 6 * 3_600_000 };

export type SourceState = {
  source: string;
  cursor: Json | null;
  pass_started_at: string | null;
  last_success_at: string | null;
  consecutive_failures: number;
  backoff_until: string | null;
  lease_expires_at: string | null;
  updated_at: string;
};

function timestamp(value: string | null | undefined): number {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Fair selection: never-run sources go first, then the least recently attempted due source.
 * An unfinished pass is eligible on the next tick even when its normal cadence is monthly. */
export function sourceSchedule(sources: readonly SourceEntry[], states: readonly SourceState[], now = Date.now()) {
  const bySource = new Map(states.map((state) => [state.source, state]));
  return sources.map((source) => {
    const state = bySource.get(source.id);
    const cadence = CADENCE_MS[source.cadence];
    const lastSuccess = timestamp(state?.last_success_at);
    const lastAttempt = timestamp(state?.updated_at);
    const leased = timestamp(state?.lease_expires_at) > now;
    const backingOff = timestamp(state?.backoff_until) > now;
    const pending = state?.cursor != null || state?.pass_started_at != null;
    const dueAt = pending || !lastSuccess ? 0 : lastSuccess + (REFRESH_MS[source.id] ?? cadence);
    const due = !leased && !backingOff && dueAt <= now;
    const health = leased ? "running" : backingOff ? "backoff" : !lastSuccess ? "never-synced" : now - lastSuccess > cadence * 2 ? "stale" : pending ? "resuming" : "healthy";
    return {
      id: source.id,
      label: source.label,
      cadence: source.cadence,
      rank: source.rank,
      health,
      due,
      pending,
      last_success_at: state?.last_success_at ?? null,
      last_attempt_at: state?.updated_at ?? null,
      next_due_at: new Date(Math.max(dueAt || now, timestamp(state?.backoff_until), timestamp(state?.lease_expires_at))).toISOString(),
      consecutive_failures: state?.consecutive_failures ?? 0,
      order: lastAttempt,
    };
  }).sort((a, b) => Number(b.due) - Number(a.due) || a.order - b.order || a.id.localeCompare(b.id));
}
