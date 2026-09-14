"use client";

import { useState } from "react";
import { toggleSaved } from "@/lib/user-events";
import { useSavedIds } from "@/lib/use-local-store";
import type { CountdownEvent } from "@/lib/types";

export function SaveButton({ id, event, compact = false }: { id: string; event?: CountdownEvent; compact?: boolean }) {
  const savedIds = useSavedIds();
  const saved = savedIds.includes(id);
  const [error, setError] = useState("");
  return (
    <div className="inline-flex max-w-full flex-col items-start gap-2">
      <button type="button" className={compact ? `flex size-11 shrink-0 items-center justify-center rounded-xl border bg-ink transition-colors ${saved ? "border-amber/50 text-amber" : "border-line text-paper-dim hover:border-amber/50 hover:text-amber"}` : "button-secondary"} aria-label={compact ? `${saved ? "Unsave" : "Save"} ${event?.title ?? "this date"}` : undefined} title={saved ? "Remove from saved dates" : "Save to your collection"} aria-pressed={saved} onClick={() => {
        try { toggleSaved(id, event); setError(""); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this countdown."); }
      }}>
        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7"><path d="M6 4h12v17l-6-4-6 4V4Z" /></svg>
        {!compact && (saved ? "Saved" : "Save date")}
      </button>
      {error && <p role="alert" className="max-w-xs rounded-lg border border-line bg-ink px-3 py-2 text-xs leading-relaxed text-paper">{error}</p>}
    </div>
  );
}
