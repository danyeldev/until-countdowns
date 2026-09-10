import { regionCodesMatching } from "@/lib/regions";
import { getDb } from "../../db";

/**
 * Read-only database access for the `wanted` adapter. Everything here is a SELECT (or the
 * `stable` `search_events` RPC); rows are written by the runner's upsert only. The interface is
 * injected so the adapter can be tested against a fake.
 */
export type WantedDb = {
  /** `q` of every `search_log` row with `results = 0` since `sinceIso`, newest first, at most `limit` rows. */
  zeroResultQueries(sinceIso: string, limit: number): Promise<string[]>;
  /** Whether the public catalog search now returns at least one row for `q`. */
  hasResults(q: string): Promise<boolean>;
  /** Which of `qids` already exist as `events.external_ids->>'qid'` (any source). */
  existingQids(qids: readonly string[]): Promise<Set<string>>;
};

export function supabaseWantedDb(): WantedDb {
  return {
    async zeroResultQueries(sinceIso, limit) {
      const db = await getDb();
      const { data, error } = await db.from("search_log").select("q").eq("results", 0).gt("at", sinceIso).order("at", { ascending: false }).limit(limit);
      if (error) throw new Error(`search_log read failed: ${error.message}`);
      return ((data ?? []) as Array<{ q: string }>).map((r) => r.q);
    },
    async hasResults(q) {
      const db = await getDb();
      const { data, error } = await db.rpc("search_events", {
        p_q: q,
        p_region_codes: regionCodesMatching(q),
        p_sort: "soonest",
        p_min_popularity: 0,
        p_page: 1,
        p_page_size: 1,
      });
      if (error) throw new Error(`search_events failed: ${error.message}`);
      return Array.isArray(data) && data.length > 0;
    },
    async existingQids(qids) {
      if (!qids.length) return new Set();
      const db = await getDb();
      const { data, error } = await db
        .from("events")
        .select("external_ids")
        .in("external_ids->>qid", [...qids]);
      if (error) throw new Error(`events qid lookup failed: ${error.message}`);
      const out = new Set<string>();
      for (const row of (data ?? []) as Array<{ external_ids: unknown }>) {
        const qid = (row.external_ids as { qid?: unknown } | null)?.qid;
        if (typeof qid === "string") out.add(qid);
      }
      return out;
    },
  };
}
