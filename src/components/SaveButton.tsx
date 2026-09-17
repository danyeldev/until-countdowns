"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { safeNextPath } from "@/lib/auth/paths";
import { isPersonalCollectionEvent, rememberPendingSave, takePendingSave } from "@/lib/collection";
import type { CountdownEvent } from "@/lib/types";
import { AuthDialog } from "./AuthDialog";

export function SaveButton({ id, event, compact = false }: { id: string; event?: CountdownEvent; compact?: boolean }) {
  const pathname = usePathname();
  const { ready, userId, savedIds, mine, toggleSaved } = useCollection();
  const personal = isPersonalCollectionEvent(event, id);
  const saved = personal
    ? mine.some((item) => item.id === id || item.slug === event?.slug || item.slug === id)
    : savedIds.includes(id);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const compactClass = `flex size-10 shrink-0 items-center justify-center rounded-full bg-ink/70 backdrop-blur-md transition-colors ${saved ? "text-amber" : "text-paper hover:text-amber"}`;
  const icon = (
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7">
      <path d="M6 4h12v17l-6-4-6 4V4Z" />
    </svg>
  );

  useEffect(() => {
    if (!ready || !userId) return;
    const pendingSave = takePendingSave();
    if (!pendingSave) return;
    if (pendingSave.id !== id) {
      rememberPendingSave(pendingSave);
      return;
    }
    if (saved) return;
    void toggleSaved(id, pendingSave.event ?? event)
      .then(() => setError(""))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not save this countdown."));
  }, [event, id, ready, saved, toggleSaved, userId]);

  if (!ready) {
    return compact
      ? <span className="block size-10 rounded-full bg-ink/70" aria-hidden="true" />
      : <span className="button-secondary pointer-events-none opacity-50">{icon}Save</span>;
  }

  return (
    <div className="inline-flex max-w-full flex-col items-start gap-2">
      <button
        type="button"
        className={compact ? compactClass : "button-secondary"}
        aria-label={compact ? `${saved ? "Unsave" : "Save"} ${event?.title ?? "this date"}` : undefined}
        title={saved ? "Remove from your collection" : "Save to your collection"}
        aria-pressed={userId ? saved : undefined}
        aria-haspopup={userId ? undefined : "dialog"}
        aria-expanded={userId ? undefined : authOpen}
        disabled={pending}
        onClick={() => {
          if (!userId) {
            rememberPendingSave({ id, event });
            setAuthOpen(true);
            return;
          }
          setPending(true);
          void toggleSaved(id, event)
            .then(() => setError(""))
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not save this countdown."))
            .finally(() => setPending(false));
        }}
      >
        {icon}
        {!compact && (saved ? "Saved" : "Save")}
      </button>
      {error && <p role="alert" className="notice max-w-xs !text-xs">{error}</p>}
      {authOpen ? (
        <AuthDialog
          next={safeNextPath(pathname)}
          heading="Sign in to save this."
          subtitle="Use Google or your email. We’ll save this countdown after you sign in."
          onClose={() => setAuthOpen(false)}
        />
      ) : null}
    </div>
  );
}
