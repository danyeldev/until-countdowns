import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/database.types";
import { publicSupabaseEnv } from "./env";

export function createAuthBrowserClient() {
  const env = publicSupabaseEnv();
  if (!env) {
    throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  return createBrowserClient<Database>(env.url, env.key);
}
