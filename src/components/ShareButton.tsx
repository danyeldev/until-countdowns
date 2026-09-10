"use client";

import { useState } from "react";

/** Both states, taken from `L.m.common.actions` by the server parent. */
type Labels = { share: string; shareCopied: string };

/** `path` is already the reader's own URL for the page — the link they share must stay in their language. */
export function ShareButton({ title, path, labels }: { title: string; path: string; labels: Labels }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={share}
      className="rounded-full border border-line px-4 py-2 text-sm text-paper hover:border-amber/50 hover:text-amber"
    >
      {copied ? labels.shareCopied : labels.share}
    </button>
  );
}
