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
export async function updateSession(request: NextRequest) {
  if (!publicSupabaseEnv() || !hasSupabaseAuthCookies(request.cookies.getAll())) {
    return NextResponse.next({ request });
  }

  const env = publicSupabaseEnv()!;
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Must run immediately so a refresh can write cookies onto this response.
  // getUser() also drops a cookie whose Auth user no longer exists (JWT can
  // still verify after a delete until it expires).
  const { error } = await supabase.auth.getUser();
  if (isStaleAuthSession(error)) {
    await supabase.auth.signOut({ scope: "local" });
  }

  return response;
}
