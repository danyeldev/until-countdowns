"use client";

import type { ReactNode } from "react";
import { CollectionProvider } from "@/components/CollectionProvider";
import { NotificationsProvider } from "@/components/NotificationsProvider";
import { PostHogIdentify } from "@/components/PostHogIdentify";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <CollectionProvider>
      <PostHogIdentify />
      <NotificationsProvider>{children}</NotificationsProvider>
    </CollectionProvider>
  );
}
