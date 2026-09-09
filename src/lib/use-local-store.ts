"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { CountdownEvent } from "./types";
import {
  emptySnapshot,
  getMineSnapshot,
  getSavedSnapshot,
  subscribeStore,
} from "./user-events";

export function useMine(): CountdownEvent[] {
  const raw = useSyncExternalStore(subscribeStore, getMineSnapshot, emptySnapshot);
  return useMemo(() => {
    try {
      return JSON.parse(raw) as CountdownEvent[];
    } catch {
      return [];
    }
  }, [raw]);
}

export function useSavedIds(): string[] {
  const raw = useSyncExternalStore(subscribeStore, getSavedSnapshot, emptySnapshot);
  return useMemo(() => {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }, [raw]);
}
