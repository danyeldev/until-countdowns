"use client";

import { useLocale, useTranslations } from "next-intl";
import { localizePath } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useCollection } from "@/components/CollectionProvider";
import type { AuthMode } from "@/lib/auth/paths";
import { isAuthGatedPath, safeNextPath } from "@/lib/auth/paths";
import { AuthDialog } from "./AuthDialog";

export function SignInButton({
  next,
  className,
  children,
  heading,
  subtitle,
  initialMode,
  ariaLabel,
  title,
  onOpen,
}: {
  next?: string;
  className?: string;
  children: ReactNode;
  heading?: string;
  subtitle?: string;
  initialMode?: AuthMode;
  ariaLabel?: string;
  title?: string;
  onOpen?: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={ariaLabel}
        title={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        {children}
      </button>
      {open ? (
        <AuthDialog
          next={safeNextPath(next ?? pathname)}
          heading={heading}
          subtitle={subtitle}
          initialMode={initialMode}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export { isAuthGatedPath };

export function AuthGateLink({
  href,
  className,
  children,
  ariaLabel,
  ariaCurrent,
  heading,
  subtitle,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  ariaCurrent?: "page";
  heading?: string;
  subtitle?: string;
}) {
  const { ready, userId } = useCollection();
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const t = useTranslations("auth");
  const gated = isAuthGatedPath(href);

  return (
    <>
      <Link
        href={href}
        className={className}
        aria-label={ariaLabel}
        aria-current={ariaCurrent}
        onClick={(event) => {
          if (!gated || !ready || userId) return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </Link>
      {open ? (
        <AuthDialog
          next={safeNextPath(localizePath(href, locale))}
          heading={heading ?? t("signIn")}
          subtitle={subtitle}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
