import { DEFAULT_LOCALE } from "./locales";
import { routing } from "./routing";

/** Cheap pages can prerender every locale. */
export function allLocaleParams(): { locale: string }[] {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Heavy catalog routes only prerender English. Other locales fill in via ISR
 * so the build does not multiply by 27.
 */
export function englishParams<T extends Record<string, string>>(
  rows: T[],
): Array<T & { locale: string }> {
  return rows.map((row) => ({ ...row, locale: DEFAULT_LOCALE }));
}
