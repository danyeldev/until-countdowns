"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { CountdownEvent } from "./types";
import { emptySnapshot, getMineSnapshot, getSavedSnapshot, getSavedEventsSnapshot, parseMine, parseSavedEvents, parseSavedIds, subscribeStore } from "./user-events";

const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function useLocalStoreReady(): boolean {
  return useSyncExternalStore(subscribeHydration, clientReady, serverReady);
}

export function useMine(): CountdownEvent[] {
  const raw = useSyncExternalStore(subscribeStore, getMineSnapshot, emptySnapshot);
  return useMemo(() => parseMine(raw), [raw]);
}

export function useSavedIds(): string[] {
  const raw = useSyncExternalStore(subscribeStore, getSavedSnapshot, emptySnapshot);
  return useMemo(() => parseSavedIds(raw), [raw]);
}

export function useSavedEvents(): CountdownEvent[] {
  const raw = useSyncExternalStore(subscribeStore, getSavedEventsSnapshot, emptySnapshot);
  return useMemo(() => parseSavedEvents(raw), [raw]);
}
