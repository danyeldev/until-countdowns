import { pathnameWithoutLocale } from "@/i18n/locales";
import { isAuthGatedPath } from "./auth/paths";

/**
 * Routes that render per request and cache nothing: the auth-gated pages, the sign-in form and
 * the `/calendar` redirect to the current month. The router prefetches every `<Link>` that
 * enters the viewport, and the site chrome links to these on every page — so each page view
 * used to fire three to five function invocations that returned nothing reusable. Headless
 * renderers do it too: when Google drew an event page in September 2026, its browser prefetched
 * `/calendar`, `/create` and `/login` — about one request a second, none of them a visitor.
 *
 * `prefetch={false}` still prefetches on hover, so a click stays fast.
 */
export function isPerRequestRoute(href: string): boolean {
  const path = pathnameWithoutLocale(href).split("?")[0] ?? href;
  return isAuthGatedPath(path) || path === "/login" || path.startsWith("/login/") || path === "/calendar";
}

/** Spread onto a `<Link>` whose target `isPerRequestRoute`. */
export const NO_PREFETCH = { prefetch: false } as const;
