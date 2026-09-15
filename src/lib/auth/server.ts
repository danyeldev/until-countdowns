import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/db/database.types";
import { publicSupabaseEnv } from "./env";
import { completeProfileHref, loginHref } from "./paths";

export async function createAuthServerClient() {
  const env = publicSupabaseEnv();
  if (!env) {
    throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  const cookieStore = await cookies();
  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component that cannot write cookies. proxy.ts refreshes the session.
        }
      },
    },
  });
}

/** Verified JWT claims, or null when there is no session. Never trust getSession() for this. */
export async function getAuthClaims() {
  if (!publicSupabaseEnv()) return null;
  const supabase = await createAuthServerClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
}

export type OwnProfile = { name: string; handle: string | null };

export async function getOwnProfile(): Promise<OwnProfile | null> {
  const claims = await getAuthClaims();
  if (!claims?.sub || typeof claims.sub !== "string") return null;
  const supabase = await createAuthServerClient();
  const { data } = await supabase.from("profiles").select("name, handle").eq("id", claims.sub).maybeSingle();
  if (!data) return { name: "", handle: null };
  return { name: data.name ?? "", handle: data.handle };
}

export function profileIsComplete(profile: OwnProfile | null): boolean {
  return Boolean(profile?.handle);
}

export async function requireAuth(next: string, options?: { allowIncomplete?: boolean }) {
  if (!(await getAuthClaims())) redirect(loginHref(next));
  if (options?.allowIncomplete) return;
  if (!profileIsComplete(await getOwnProfile())) redirect(completeProfileHref(next));
}
