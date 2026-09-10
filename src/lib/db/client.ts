import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { boundedFetch } from "./fetch";

/**
 * Anonymous (publishable-key) Supabase client for the read path. RLS applies.
 * Server-side only: never import this from a client component — it would pull
 * supabase-js into the browser bundle.
 */
let client: SupabaseClient<Database> | null = null;

export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function anonClient(): SupabaseClient<Database> {
  if (client) return client;
  const env = supabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  client = createClient<Database>(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: boundedFetch() },
  });
  return client;
}
