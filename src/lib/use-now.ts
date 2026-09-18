"use client";

import { useSyncExternalStore } from "react";

/**
 * One shared 1-second ticker for every countdown on the page.
 * The server snapshot is `null`, so server-rendered markup never contains a
 * clock value that could disagree with the browser (no hydration mismatch);
 * components render placeholders until the first client tick.
 */
let now = 0;
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  now = Date.now();
  for (const notify of subscribers) notify();
}

function visibilityChanged() {
  if (document.visibilityState === "hidden") {
    if (timer !== null) clearInterval(timer);
    timer = null;
  } else if (subscribers.size > 0 && timer === null) {
    tick();
    timer = setInterval(tick, 1000);
  }
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  if (subscribers.size === 1) {
    now = Date.now();
    if (document.visibilityState !== "hidden") timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", visibilityChanged);
  }
  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0) {
      if (timer !== null) clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", visibilityChanged);
    }
  };
}

function getSnapshot(): number {
  // Must not call Date.now() here. React reads this during hydration to compare
  // with getServerSnapshot; stamping a live clock would paint hours/minutes over
  // the server `--` placeholders and abort the ticker.
  return now;
}

function getServerSnapshot(): null {
  return null;
}

function subscribeDisabled(): () => void {
  return () => undefined;
}

/** Current epoch milliseconds on the client, `null` during SSR, hydration, or when disabled. */
export function useNow(enabled = true): number | null {
  const value = useSyncExternalStore(
    enabled ? subscribe : subscribeDisabled,
    getSnapshot,
    getServerSnapshot,
  );
  if (!enabled || value === 0) return null;
  return value;
}
