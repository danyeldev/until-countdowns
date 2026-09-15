"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { loginHref, safeNextPath } from "@/lib/auth/paths";
import { isPersonalCollectionEvent } from "@/lib/collection";
import type { CountdownEvent } from "@/lib/types";

export function SaveButton({ id, event, compact = false }: { id: string; event?: CountdownEvent; compact?: boolean }) {
  const pathname = usePathname();
  const { ready, userId, savedIds, mine, toggleSaved } = useCollection();
  const personal = isPersonalCollectionEvent(event, id);
  const saved = personal
    ? mine.some((item) => item.id === id || item.slug === event?.slug || item.slug === id)
    : savedIds.includes(id);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const href = loginHref(safeNextPath(pathname));
  const compactClass = `flex size-11 shrink-0 items-center justify-center rounded-xl border bg-ink transition-colors ${saved ? "border-amber/50 text-amber" : "border-line text-paper-dim hover:border-amber/50 hover:text-amber"}`;
  const icon = (
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7">
      <path d="M6 4h12v17l-6-4-6 4V4Z" />
    </svg>
  );

  if (!ready) {
    return compact
      ? <span className="size-11 rounded-xl border border-line bg-ink" aria-hidden="true" />
      : <span className="button-secondary pointer-events-none opacity-50">{icon}Save date</span>;
  }

  if (!userId) {
    return (
      <Link
        href={href}
        className={compact ? compactClass : "button-secondary"}
        aria-label={compact ? `Sign in to save ${event?.title ?? "this date"}` : undefined}
        title="Sign in to save this countdown"
      >
        {icon}
        {!compact && "Sign in to save"}
      </Link>
    );
  }

  return (
    <div className="inline-flex max-w-full flex-col items-start gap-2">
      <button
        type="button"
        className={compact ? compactClass : "button-secondary"}
        aria-label={compact ? `${saved ? "Unsave" : "Save"} ${event?.title ?? "this date"}` : undefined}
        title={saved ? "Remove from your collection" : "Save to your collection"}
        aria-pressed={saved}
        disabled={pending}
        onClick={() => {
          setPending(true);
          void toggleSaved(id, event)
            .then(() => setError(""))
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not save this countdown."))
            .finally(() => setPending(false));
        }}
      >
        {icon}
        {!compact && (saved ? "Saved" : "Save date")}
      </button>
      {error && <p role="alert" className="max-w-xs rounded-lg border border-line bg-ink px-3 py-2 text-xs leading-relaxed text-paper">{error}</p>}
    </div>
  );
}
