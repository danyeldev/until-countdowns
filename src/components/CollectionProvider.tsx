"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createAuthBrowserClient } from "@/lib/auth/browser";
import { isAuthConfigured } from "@/lib/auth/env";
import {
  COLLECTION_MAX,
  collectionErrorMessage,
  countdownFromRow,
  eventFromSnapshot,
  isPersonalCollectionEvent,
  snapshotFromEvent,
} from "@/lib/collection";
import { recordHype } from "@/lib/hype-client";
import { hypeEventKey } from "@/lib/hype";
import type { CountdownEvent } from "@/lib/types";
import { assertUserEvent } from "@/lib/user-events";
import { capture } from "@/lib/analytics";

type CollectionState = {
  ready: boolean;
  userId: string | null;
  savedIds: string[];
  savedEvents: CountdownEvent[];
  mine: CountdownEvent[];
  toggleSaved: (id: string, event?: CountdownEvent) => Promise<void>;
  upsertMine: (event: CountdownEvent) => Promise<CountdownEvent>;
  removeMine: (id: string) => Promise<void>;
  cacheSavedEvents: (events: CountdownEvent[]) => Promise<void>;
};

const CollectionContext = createContext<CollectionState | null>(null);

export function useCollection(): CollectionState {
  const value = useContext(CollectionContext);
  if (!value) throw new Error("useCollection must be used within CollectionProvider");
  return value;
}

function emptyCollection() {
  return { mine: [] as CountdownEvent[], savedIds: [] as string[], savedEvents: [] as CountdownEvent[] };
}

export function CollectionProvider({ children }: { children: ReactNode }) {
  const configured = isAuthConfigured();
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionKnown, setSessionKnown] = useState(!configured);
  const [mine, setMine] = useState<CountdownEvent[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedEvents, setSavedEvents] = useState<CountdownEvent[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    const supabase = createAuthBrowserClient();
    let cancelled = false;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null;
      setUserId(id);
      setSessionKnown(true);
      if (!id) {
        const empty = emptyCollection();
        setMine(empty.mine);
        setSavedIds(empty.savedIds);
        setSavedEvents(empty.savedEvents);
        setLoadedFor(null);
        return;
      }
      void Promise.all([
        supabase.from("user_countdowns").select("slug, title, date, description, category, created_at").order("created_at", { ascending: false }),
        supabase.from("user_saved").select("event_id, snapshot, created_at").order("created_at", { ascending: false }),
      ]).then(([mineResult, savedResult]) => {
        if (cancelled) return;
        if (!mineResult.error) setMine((mineResult.data ?? []).map(countdownFromRow));
        if (!savedResult.error) {
          setSavedIds((savedResult.data ?? []).map((row) => row.event_id));
          setSavedEvents(
            (savedResult.data ?? []).flatMap((row) => {
              const event = eventFromSnapshot(row.snapshot, row.event_id);
              return event ? [event] : [];
            }),
          );
        }
        setLoadedFor(id);
      });
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [configured]);

  const ready = sessionKnown && (!userId || loadedFor === userId);

  const upsertMine = useCallback(async (event: CountdownEvent) => {
    if (!userId) throw new Error("Sign in to save this countdown.");
    const next = assertUserEvent(event);
    if (mine.length >= COLLECTION_MAX && !mine.some((item) => item.slug === next.slug)) {
      throw new Error(`You have ${COLLECTION_MAX} personal countdowns. Remove one before adding another.`);
    }
    const supabase = createAuthBrowserClient();
    const { error } = await supabase.from("user_countdowns").upsert(
      {
        user_id: userId,
        slug: next.slug,
        title: next.title,
        description: next.description.slice(0, 500),
        date: next.date,
        category: next.category,
      },
      { onConflict: "user_id,slug" },
    );
    if (error) throw new Error(collectionErrorMessage(error));
    capture("countdown_created", { slug: next.slug, title: next.title, category: next.category });
    setMine((current) => [next, ...current.filter((item) => item.slug !== next.slug)]);
    return next;
  }, [mine, userId]);

  const removeMine = useCallback(async (id: string) => {
    if (!userId) throw new Error("Sign in to change your collection.");
    const supabase = createAuthBrowserClient();
    const { error } = await supabase.from("user_countdowns").delete().eq("slug", id);
    if (error) throw new Error(collectionErrorMessage(error));
    capture("countdown_unsaved", { event_id: id, personal: true });
    setMine((current) => current.filter((item) => item.id !== id && item.slug !== id));
  }, [userId]);

  const toggleSaved = useCallback(async (id: string, event?: CountdownEvent) => {
    if (!userId) throw new Error("Sign in to save this countdown.");
    if (isPersonalCollectionEvent(event, id)) {
      if (mine.some((item) => item.id === id || item.slug === event?.slug)) {
        await removeMine(event?.slug ?? id);
        return;
      }
      if (!event) throw new Error("This countdown cannot be saved.");
      await upsertMine(event);
      const key = hypeEventKey(event);
      if (key) void recordHype(key, "save");
      return;
    }
    const removing = savedIds.includes(id);
    if (!removing && savedIds.length >= COLLECTION_MAX) {
      throw new Error(`You have ${COLLECTION_MAX} saved countdowns. Remove one before saving another.`);
    }
    const supabase = createAuthBrowserClient();
    if (removing) {
      const { error } = await supabase.from("user_saved").delete().eq("event_id", id);
      if (error) throw new Error(collectionErrorMessage(error));
      capture("countdown_unsaved", { event_id: id, title: event?.title, category: event?.category });
      setSavedIds((current) => current.filter((value) => value !== id));
      setSavedEvents((current) => current.filter((item) => item.id !== id));
      return;
    }
    const snapshot = event ? snapshotFromEvent({ ...event, id }) : null;
    const { error } = await supabase.from("user_saved").insert({
      user_id: userId,
      event_id: id,
      snapshot,
    });
    if (error) throw new Error(collectionErrorMessage(error));
    capture("countdown_saved", { event_id: id, title: event?.title, category: event?.category });
    setSavedIds((current) => [id, ...current.filter((value) => value !== id)]);
    const parsed = snapshot ? eventFromSnapshot(snapshot, id) : null;
    if (parsed) setSavedEvents((current) => [parsed, ...current.filter((item) => item.id !== id)]);
  }, [mine, removeMine, savedIds, upsertMine, userId]);

  const cacheSavedEvents = useCallback(async (events: CountdownEvent[]) => {
    if (!userId || events.length === 0) return;
    const known = new Set(savedIds);
    const rows = events.filter((event) => known.has(event.id)).map((event) => ({
      user_id: userId,
      event_id: event.id,
      snapshot: snapshotFromEvent(event),
    }));
    if (!rows.length) return;
    const supabase = createAuthBrowserClient();
    const { error } = await supabase.from("user_saved").upsert(rows, { onConflict: "user_id,event_id" });
    if (error) return;
    setSavedEvents((current) => {
      const merged = new Map(current.map((event) => [event.id, event]));
      for (const event of events) if (known.has(event.id)) merged.set(event.id, event);
      return [...merged.values()].filter((event) => known.has(event.id));
    });
  }, [savedIds, userId]);

  const value = useMemo<CollectionState>(() => ({
    ready,
    userId,
    savedIds,
    savedEvents,
    mine,
    toggleSaved,
    upsertMine,
    removeMine,
    cacheSavedEvents,
  }), [cacheSavedEvents, mine, ready, removeMine, savedEvents, savedIds, toggleSaved, upsertMine, userId]);

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}
