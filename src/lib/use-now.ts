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

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  if (timer === null) {
    now = Date.now();
    timer = setInterval(tick, 1000);
  }
  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  if (now === 0) now = Date.now();
  return now;
}

function getServerSnapshot(): null {
  return null;
}

/** Current epoch milliseconds on the client, `null` during SSR and hydration. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
