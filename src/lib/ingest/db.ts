import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

export type Db = SupabaseClient<Database>;

/**
 * Service-role client, loaded lazily so that importing the ingest library never pulls the
 * `server-only` guard (src/lib/db/admin.ts) at module load: the vitest suite imports the pure
 * parts of this library, and the CLI runs under `--conditions=react-server`.
 */
export async function getDb(): Promise<Db> {
  const mod = await import("@/lib/db/admin");
  return mod.serviceClient();
}

/** Per-call deadline for the heavier RPCs (`upsert_events`, `mark_stale_records`). */
export const RPC_TIMEOUT_MS = 30_000;
/** `finalize_catalog()` rewrites status/indexable over the whole table; give it up to ~2 minutes. */
export const FINALIZE_TIMEOUT_MS = 110_000;

const longClients = new Map<number, Db>();

/**
 * Service-role client whose requests may take up to `timeoutMs` (the default client aborts after
 * 10 s, which is right for page reads but too short for the catalog-wide RPCs). One client per
 * timeout is cached for the life of the process.
 */
export async function getLongDb(timeoutMs: number): Promise<Db> {
  const cached = longClients.get(timeoutMs);
  if (cached) return cached;
  await import("server-only");
  const [{ createClient }, { boundedFetch }] = await Promise.all([import("@supabase/supabase-js"), import("@/lib/db/fetch")]);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service client is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
  }
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: boundedFetch(timeoutMs) },
  });
  longClients.set(timeoutMs, client);
  return client;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return String(err);
}
