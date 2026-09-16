"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useCollection } from "@/components/CollectionProvider";
import type { AuthMode } from "@/lib/auth/paths";
import { safeNextPath } from "@/lib/auth/paths";
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

export function isAuthGatedPath(href: string) {
  const path = href.split("?")[0] ?? href;
  return (
    path === "/saved" ||
    path === "/create" ||
    path === "/notifications" ||
    path === "/collections" ||
    path.startsWith("/collections/")
  );
}

export function AuthGateLink({
  href,
  className,
  children,
  ariaLabel,
  ariaCurrent,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  ariaCurrent?: "page";
}) {
  const { ready, userId } = useCollection();
  const [open, setOpen] = useState(false);
  const gated = isAuthGatedPath(href);

  if (!gated || !ready || userId) {
    return (
      <Link href={href} className={className} aria-label={ariaLabel} aria-current={ariaCurrent}>
        {children}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open ? (
        <AuthDialog
          next={safeNextPath(href)}
          heading="Sign in to continue."
          subtitle="Use Google or your email to open your space."
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
