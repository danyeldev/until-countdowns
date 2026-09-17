"use client";

import { useEffect } from "react";
import { capture } from "@/lib/analytics";

export function TrackCountdown({
  slug,
  title,
  category,
  source,
}: {
  slug: string;
  title: string;
  category: string;
  source: string;
}) {
  useEffect(() => {
    capture("countdown_viewed", { slug, title, category, source });
  }, [category, slug, source, title]);

  return null;
}
