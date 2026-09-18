import { setRequestLocale } from "next-intl/server";
import { localeOf } from "./locales";

/** next-intl needs this in every page (not only the layout) for the route to stay static. */
export function activateLocale(locale: string): string {
  const value = localeOf(locale);
  setRequestLocale(value);
  return value;
}
