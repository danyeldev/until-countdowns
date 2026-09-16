"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { createAuthBrowserClient } from "@/lib/auth/browser";
import { isAuthConfigured } from "@/lib/auth/env";
import { listUserNotifications, markNotificationsRead } from "@/lib/notifications-client";
import { unreadNotificationCount, type UserNotification } from "@/lib/notifications";

type NotificationsState = {
  ready: boolean;
  items: UserNotification[];
  unread: number;
  refresh: () => Promise<void>;
  markRead: (ids?: string[]) => Promise<void>;
};

const NotificationsContext = createContext<NotificationsState | null>(null);

export function useNotifications(): NotificationsState {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications must be used within NotificationsProvider");
  return value;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const configured = isAuthConfigured();
  const { ready: collectionReady, userId } = useCollection();
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    const rows = await listUserNotifications(createAuthBrowserClient());
    setItems(rows);
    setLoadedFor(id);
  }, []);

  useEffect(() => {
    if (!configured || !userId) return;
    let cancelled = false;
    const id = userId;
    void listUserNotifications(createAuthBrowserClient())
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        setLoadedFor(id);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setLoadedFor(id);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, userId]);

  useEffect(() => {
    if (userId) return;
    const frame = requestAnimationFrame(() => {
      setItems([]);
      setLoadedFor(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const id = userId;
    function onFocus() {
      if (document.visibilityState === "hidden") return;
      void load(id).catch(() => undefined);
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load, userId]);

  const markRead = useCallback(async (ids?: string[]) => {
    const unreadIds = items.filter((item) => !item.readAt && (!ids || ids.includes(item.id))).map((item) => item.id);
    if (!unreadIds.length) return;
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => (unreadIds.includes(item.id) ? { ...item, readAt: item.readAt ?? now } : item)));
    try {
      await markNotificationsRead(createAuthBrowserClient(), ids);
    } catch {
      if (userId) void load(userId).catch(() => undefined);
    }
  }, [items, load, userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    await load(userId);
  }, [load, userId]);

  const value = useMemo<NotificationsState>(() => {
    const visible = userId ? items : [];
    return {
      ready: !configured || (collectionReady && (!userId || loadedFor === userId)),
      items: visible,
      unread: unreadNotificationCount(visible),
      refresh,
      markRead,
    };
  }, [collectionReady, configured, items, loadedFor, markRead, refresh, userId]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
