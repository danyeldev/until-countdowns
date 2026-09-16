"use client";

import { useLocale, useTranslations } from "next-intl";
import { LOCALES, localeEndonym, type Locale } from "@/i18n/locales";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common");

  return (
    <label className={`inline-flex items-center gap-2 ${compact ? "text-[10px]" : "text-xs"} text-muted`}>
      <span className="sr-only">{t("language")}</span>
      <select
        value={locale}
        aria-label={t("language")}
        className="max-w-[11rem] rounded-lg border border-white/10 bg-ink/80 px-2 py-1.5 text-paper-dim hover:border-amber/40"
        onChange={(event) => {
          router.replace(pathname, { locale: event.target.value as Locale });
        }}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {localeEndonym(code)}
          </option>
        ))}
      </select>
    </label>
  );
}
