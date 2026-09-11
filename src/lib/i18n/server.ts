/**
 * The one call a Server Component makes: `const L = await localePage()` in a page,
 * `const L = await i18n()` in a shared component.
 *
 * The locale comes from `next/root-params`, which works because `[locale]` sits above the root
 * layout — so a component nested six levels down reads it without anyone prop-drilling. Two
 * restrictions come with that and are worth knowing before you reach for it:
 *
 * - **Not in Route Handlers.** `/api/*`, `/og/*`, `/embed/*`, `sitemap.ts` and `robots.ts` cannot
 *   call this; they import `i18nFor()` / `EN` from `./localized` instead.
 * - **Not inside `unstable_cache`.** `src/lib/catalog.ts` caches every read through it, so the
 *   catalog stays locale-free and translation happens on the way out, in `content.ts`.
 */
import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { bind } from "./bind";
import { isLocale, toLocale, type Locale } from "./config";
import { i18nFor, type Localized } from "./localized";
import { messagesFor } from "./messages";

export { i18nFor };
export type I18n = Localized;

/** The current locale, or `en` for anything that is not one. */
export async function getLocale(): Promise<Locale> {
  return toLocale(await localeParam());
}

/** Lenient: an unknown segment renders in English. For the layout and shared components. */
export async function i18n(): Promise<I18n> {
  const locale = await getLocale();
  return { ...bind(locale), m: messagesFor(locale) };
}

/**
 * What every `page.tsx` under `[locale]` calls. Identical to `i18n()` except that an unknown first
 * segment is a 404 rather than English.
 *
 * It is the second line of defence. The routing table already sends a bare unknown segment to a
 * 404 (see `routing.ts`), but that rule only matches dot-free single segments, so `/foo.bar` still
 * arrives here as a locale.
 *
 * What a 404 looks like in this app is worth knowing before you reach for it: with the root layout
 * under a dynamic segment, Next serves the not-found route as a bare `__next_error__` document with
 * the real markup in the flight payload, so the status line is right and the page paints after
 * hydration. That is Next's behaviour for any page-thrown `notFound()` here, not something this
 * change introduced — a bad event slug has always answered that way.
 */
export async function localePage(): Promise<I18n> {
  const raw = await localeParam();
  if (!isLocale(raw)) notFound();
  return i18nFor(raw);
}
