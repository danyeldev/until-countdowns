"use client";

import { useTranslations } from "next-intl";
import { useCollection } from "@/components/CollectionProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { AuthGateLink } from "./SignInButton";
import { Link } from "@/i18n/navigation";

export function Footer() {
  const t = useTranslations("footer");
  const { userId } = useCollection();
  return (
    <footer className="app-footer">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 border-t border-line/60 pt-5 text-xs text-muted">
        <p>
          <span className="font-medium text-paper-dim">until</span>
          <span className="mx-2 text-line">/</span>
          {t("tagline")}
        </p>
        <nav aria-label={t("about")} className="flex flex-wrap items-center gap-5">
          <Link href="/category" className="hover:text-paper">
            {t("categories")}
          </Link>
          <Link href="/country" className="hover:text-paper">
            {t("countries")}
          </Link>
          <Link href="/about" className="hover:text-paper">
            {t("aboutSources")}
          </Link>
          <Link href="/attributions" className="hover:text-paper">
            {t("attributions")}
          </Link>
          {userId ? (
            <AuthGateLink href="/saved" className="hover:text-paper">
              {t("yourSpace")}
            </AuthGateLink>
          ) : null}
          <Link href="/collections" className="hover:text-paper">
            {t("collections")}
          </Link>
          {userId ? (
            <AuthGateLink href="/notifications" className="hover:text-paper">
              {t("notifications")}
            </AuthGateLink>
          ) : null}
          <LanguageSwitcher compact />
        </nav>
      </div>
    </footer>
  );
}

export const FooterFallback = Footer;
