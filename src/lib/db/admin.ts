import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { boundedFetch } from "./fetch";

/**
 * Service (secret-key) client. Bypasses RLS — only for ingestion, enrichment and
 * cron handlers (`src/lib/ingest/**`, `src/lib/enrich/**`, `src/app/api/cron/**`).
 * Pages and the public read path must use `anonClient()`.
 */
let client: SupabaseClient<Database> | null = null;

export function serviceClient(): SupabaseClient<Database> {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service client is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
  }
  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: boundedFetch() },
  });
  return client;
}
