"use client";

import { useEffect, useRef } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { identifyUser } from "@/lib/analytics";

export function PostHogIdentify() {
  const { ready, userId } = useCollection();
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !userId || lastId.current === userId) return;
    lastId.current = userId;
    identifyUser(userId);
  }, [ready, userId]);

  return null;
}
