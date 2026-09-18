"use client";

import dynamic from "next/dynamic";
import { Link } from "@/i18n/navigation";
import { useAuthCookie } from "@/lib/auth-cookie";

const AuthMenu = dynamic(() => import("./AuthMenu").then((mod) => mod.AuthMenu), { ssr: false });
const NotificationBell = dynamic(() => import("./NotificationBell").then((mod) => mod.NotificationBell), {
  ssr: false,
});

export function HeaderAuth() {
  const signedIn = useAuthCookie();

  if (!signedIn) {
    return (
      <Link
        href="/login"
        className="flex min-h-11 items-center rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-xs text-paper-dim transition hover:border-amber/40 hover:text-paper"
      >
        Sign in
      </Link>
    );
  }

  return (
    <>
      <NotificationBell />
      <AuthMenu />
    </>
  );
}

export function useSignedInHint(): boolean {
  return useAuthCookie();
}
