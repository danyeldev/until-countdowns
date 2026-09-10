/**
 * A locale bound to its catalogue, without `next/root-params`.
 *
 * Route Handlers (`/og/*`, `/embed/*`, `/api/oembed`, `sitemap.ts`, `robots.ts`) cannot read root
 * parameters, but they still need to render text. They import from here and name the locale
 * themselves — usually `EN`, because a card, a sitemap or a widget is not a page in the reader's
 * language.
 */
import { bind, type Localized } from "./bind";
import type { Locale } from "./config";
import { messagesFor } from "./messages";

export type { Localized };

export function i18nFor(locale: Locale): Localized {
  return { ...bind(locale), m: messagesFor(locale) };
}

/**
 * The English binding, for everything that is English by design: the OG cards (their font subsets
 * are Latin-only — a Japanese or Polish card would render as tofu), the `.ics` payloads, and the
 * sitemaps.
 */
export const EN: Localized = i18nFor("en");
