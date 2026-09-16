"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { signOutAction } from "@/lib/auth/actions";
import { createAuthBrowserClient } from "@/lib/auth/browser";
import { isAuthConfigured } from "@/lib/auth/env";
import { profileHref } from "@/lib/auth/profile";
import { SignInButton } from "./SignInButton";

type Account = { email: string; label: string; handle: string | null };

function accountFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): Account | null {
  const email = user.email?.trim() || "";
  const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const handle = typeof user.user_metadata?.handle === "string" ? user.user_metadata.handle.trim() : "";
  if (!email && !name) return null;
  return { email, label: name || email, handle: handle || null };
}

function initialFor(account: Account): string {
  const source = account.label || account.email || "?";
  return source.slice(0, 1).toLocaleUpperCase();
}

export function AuthMenu() {
  const configured = isAuthConfigured();
  const [account, setAccount] = useState<Account | null | undefined>(configured ? undefined : null);

  useEffect(() => {
    if (!configured) return;
    const supabase = createAuthBrowserClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setAccount(null);
        return;
      }
      const fallback = accountFromUser(session.user);
      setAccount(fallback);
      void supabase
        .from("profiles")
        .select("name, handle")
        .eq("id", session.user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (!profile) return;
          const name = profile.name?.trim() || fallback?.label || "";
          const email = fallback?.email || "";
          if (!email && !name) return;
          setAccount({ email, label: name || email, handle: profile.handle });
        });
    });
    return () => data.subscription.unsubscribe();
  }, [configured]);

  if (account === undefined) {
    return <div className="h-11 w-[4.75rem] rounded-xl bg-white/[.03]" aria-hidden="true" />;
  }

  if (!account) {
    return (
      <SignInButton className="flex min-h-11 items-center rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-xs text-paper-dim transition hover:border-amber/40 hover:text-paper">
        Sign in
      </SignInButton>
    );
  }

  return (
    <details className="relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] py-1.5 pl-1.5 pr-3 text-xs text-paper-dim transition hover:border-amber/40 hover:text-paper [&::-webkit-details-marker]:hidden">
        <span className="flex size-8 items-center justify-center rounded-lg bg-amber/15 font-medium text-amber">
          {initialFor(account)}
        </span>
        <span className="hidden max-w-[10rem] truncate sm:inline">{account.label}</span>
        <span className="sr-only sm:hidden">Account</span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-line bg-ink-2 p-3 shadow-[0_16px_48px_#0008]">
        <p className="truncate px-2 text-sm text-paper">{account.label}</p>
        {account.handle && (
          <Link
            href={profileHref(account.handle)}
            className="mt-0.5 block truncate px-2 text-xs text-amber hover:text-paper"
          >
            @{account.handle}
          </Link>
        )}
        {account.email && account.email !== account.label && (
          <p className="mt-0.5 truncate px-2 text-xs text-muted">{account.email}</p>
        )}
        <p className="mt-2 px-2 text-xs leading-relaxed text-muted">
          {account.handle
            ? "Your public page is your handle. Saved dates stay private; collections you publish are public."
            : "Your saved dates stay with your account."}
        </p>
        <Link
          href="/collections"
          className="mt-3 flex min-h-11 items-center rounded-xl px-2 text-xs text-paper-dim hover:bg-surface-hover hover:text-paper"
        >
          Collections
        </Link>
        <Link
          href="/notifications"
          className="flex min-h-11 items-center rounded-xl px-2 text-xs text-paper-dim hover:bg-surface-hover hover:text-paper"
        >
          Notifications
        </Link>
        <form action={signOutAction} className="mt-1">
          <button type="submit" className="button-secondary w-full justify-center !min-h-11 !text-xs">
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
