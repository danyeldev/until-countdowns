"use client";

import { useState } from "react";
import { recordHype } from "@/lib/hype-client";

export function ShareButton({
  title,
  path,
  hypeKey,
}: {
  title: string;
  path: string;
  hypeKey?: string | null;
}) {
  const [result, setResult] = useState({ path: "", feedback: "", fallbackUrl: "" });
  const [busy, setBusy] = useState(false);
  const feedback = result.path === path ? result.feedback : "";
  const fallbackUrl = result.path === path ? result.fallbackUrl : "";

  async function share() {
    const url = new URL(path, window.location.origin).href;
    setBusy(true);
    setResult({ path, feedback: "", fallbackUrl: "" });
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title, url });
          if (hypeKey) void recordHype(hypeKey, "share");
          setResult({ path, feedback: "Shared.", fallbackUrl: "" });
          return;
        } catch (error) {
          // Cancelling a native share must not silently copy the link instead.
          if (error instanceof Error && error.name === "AbortError") return;
        }
      }
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      if (hypeKey) void recordHype(hypeKey, "share");
      setResult({ path, feedback: "Link copied.", fallbackUrl: "" });
    } catch {
      setResult({ path, feedback: "Select and copy this link to share it.", fallbackUrl: url });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex max-w-full flex-col items-start gap-2">
      <button type="button" onClick={share} className="button-secondary" disabled={busy}>
        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d={feedback === "Link copied." ? "m5 12 4 4L19 6" : "M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7"} /></svg>
        {busy ? "Sharing…" : feedback === "Link copied." ? "Link copied" : "Share"}
      </button>
      {feedback && <p role="status" className="max-w-xs text-xs leading-relaxed text-muted">{feedback}</p>}
      {fallbackUrl && <input aria-label="Shareable link" readOnly value={fallbackUrl} onFocus={(event) => event.currentTarget.select()} className="field min-w-0 w-full max-w-sm text-xs" />}
    </div>
  );
}
