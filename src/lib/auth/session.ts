import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/db/database.types";
import { publicSupabaseEnv } from "./env";
import { isStaleAuthSession } from "./messages";
import { hasSupabaseAuthCookies } from "./paths";

/**
 * Refresh the auth cookie on requests that already carry one. Catalog pages stay
 * cacheable for signed-out visitors: with no `sb-*` cookie this is a no-op and
 * does not write Cache-Control or Set-Cookie.
 */
export async function updateSession(request: NextRequest, response = NextResponse.next({ request })) {
  if (!publicSupabaseEnv() || !hasSupabaseAuthCookies(request.cookies.getAll())) {
    return response;
  }

  const env = publicSupabaseEnv()!;
  const nextResponse = response;

  const supabase = createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => nextResponse.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => nextResponse.headers.set(key, value));
      },
    },
  });

  const rsc =
    request.headers.get("rsc") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1" ||
    request.nextUrl.searchParams.has("_rsc");
  if (rsc) return nextResponse;

  const { data, error } = await supabase.auth.getClaims();
  if (isStaleAuthSession(error)) {
    await supabase.auth.signOut({ scope: "local" });
    return nextResponse;
  }

  const exp = typeof data?.claims?.exp === "number" ? data.claims.exp : 0;
  const nearExpiry = exp > 0 && exp * 1000 - Date.now() < 120_000;
  if (nearExpiry) {
    const { error: userError } = await supabase.auth.getUser();
    if (isStaleAuthSession(userError)) {
      await supabase.auth.signOut({ scope: "local" });
    }
  }

  return nextResponse;
}
