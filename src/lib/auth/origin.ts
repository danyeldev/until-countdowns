import { headers } from "next/headers";
import { siteUrl } from "@/lib/seo";
import { AUTH_CALLBACK_PATH } from "./paths";

/**
 * Origin used in email and OAuth redirect URLs. Production uses the configured
 * site origin so confirmations stay on the allow-listed domain. Local and
 * Vercel previews use the host the browser actually hit.
 */
export async function authRedirectOrigin(): Promise<string> {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NODE_ENV === "development") {
    const host = (await headers()).get("host");
    if (host) {
      const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
      return `${proto}://${host}`;
    }
  }
  return siteUrl();
}

export async function authCallbackUrl(next: string): Promise<string> {
  const url = new URL(AUTH_CALLBACK_PATH, `${await authRedirectOrigin()}/`);
  if (next && next !== "/") url.searchParams.set("next", next);
  return url.toString();
}
