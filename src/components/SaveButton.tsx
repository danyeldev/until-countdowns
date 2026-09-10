"use client";

import { toggleSaved } from "@/lib/user-events";
import { useSavedIds } from "@/lib/use-local-store";

/** Both states, taken from `L.m.common.actions` by the server parent. */
type Labels = { save: string; saved: string };

export function SaveButton({ id, labels }: { id: string; labels: Labels }) {
  const savedIds = useSavedIds();
  const saved = savedIds.includes(id);

  return (
    <button
      type="button"
      onClick={() => toggleSaved(id)}
      className="rounded-full border border-line px-4 py-2 text-sm text-paper hover:border-amber/50 hover:text-amber"
      aria-pressed={saved}
    >
      {saved ? labels.saved : labels.save}
    </button>
  );
}
