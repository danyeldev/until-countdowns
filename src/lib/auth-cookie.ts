"use client";

import { useSyncExternalStore } from "react";

function hasAuthCookie(): boolean {
  return document.cookie.split(";").some((part) => part.trim().startsWith("sb-"));
}

function subscribe(notify: () => void): () => void {
  window.addEventListener("focus", notify);
  return () => window.removeEventListener("focus", notify);
}

function getServerSnapshot(): boolean {
  return false;
}

/** True when a Supabase auth cookie is present. Server snapshot is always false. */
export function useAuthCookie(): boolean {
  return useSyncExternalStore(subscribe, hasAuthCookie, getServerSnapshot);
}
