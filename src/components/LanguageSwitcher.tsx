"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/config";
import { localePath, parsePath } from "@/lib/i18n/paths";

/**
 * Fifteen real `<a href>`s to the same page in every language, each carrying `hreflang`.
 *
 * A `<select>` with an `onChange` would be smaller and would be invisible to a crawler; the point
 * of the switcher is as much that Googlebot follows it as that a reader clicks it. It is a Client
 * Component only because it needs the current path — `usePathname()` gives the public, localized
 * URL, which `parsePath()` turns back into the app-internal one so the equivalent page in another
 * language is one lookup away.
 */
export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const here = parsePath(usePathname() || "/").path;

  return (
    <nav aria-label={label}>
      <p className="text-[11px] uppercase tracking-[0.16em]">{label}</p>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {LOCALES.map((l) => {
          const meta = LOCALE_META[l];
          return (
            <li key={l}>
              <Link
                href={localePath(l, here)}
                hrefLang={meta.lang}
                lang={meta.lang}
                dir={meta.dir}
                aria-current={l === locale ? "true" : undefined}
                className={l === locale ? "text-paper" : "hover:text-paper"}
              >
                {meta.nativeName}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
