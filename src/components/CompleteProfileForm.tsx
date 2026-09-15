"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { unstable_rethrow } from "next/navigation";
import { completeProfileAction } from "@/lib/auth/actions";
import { authErrorMessage } from "@/lib/auth/messages";
import {
  HANDLE_MAX,
  HANDLE_MIN,
  NAME_MAX,
  SIGNUP_PROFILE_KEY,
  normalizeHandleInput,
  readSignupProfile,
} from "@/lib/auth/profile";

function subscribeSignupProfile() {
  return () => undefined;
}

function signupProfileSnapshot(): string | null {
  try {
    return sessionStorage.getItem(SIGNUP_PROFILE_KEY);
  } catch {
    return null;
  }
}

export function CompleteProfileForm({
  next,
  initialName = "",
  initialHandle = "",
}: {
  next: string;
  initialName?: string;
  initialHandle?: string;
}) {
  const storedRaw = useSyncExternalStore(subscribeSignupProfile, signupProfileSnapshot, () => null);
  let stored: { name: string; handle: string } | null = null;
  if (storedRaw) {
    try {
      stored = readSignupProfile(JSON.parse(storedRaw) as unknown);
    } catch {
      stored = null;
    }
  }
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [handleDraft, setHandleDraft] = useState<string | null>(null);
  const name = nameDraft ?? stored?.name ?? initialName;
  const handle = handleDraft ?? stored?.handle ?? initialHandle;
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError("");
    setPending(true);
    const formData = new FormData(formEvent.currentTarget);
    formData.set("name", name);
    formData.set("handle", handle);
    formData.set("next", next);
    try {
      const result = await completeProfileAction(formData);
      if (result?.error) setError(result.error);
      else {
        try {
          sessionStorage.removeItem(SIGNUP_PROFILE_KEY);
        } catch {
          /* ignore */
        }
      }
    } catch (cause) {
      unstable_rethrow(cause);
      setError(cause instanceof Error ? authErrorMessage(cause.message) : "Could not save your profile.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="page-heading">Who should we call you?</h1>
      <p className="page-subtitle mt-3">Pick a name and a unique handle. Your public page will be /{handle || "yourname"}.</p>
      <form aria-label="Complete your profile" className="panel mt-8 space-y-5 p-5 sm:p-7" onSubmit={(event) => void onSubmit(event)}>
        <label className="block">
          <span className="field-label">Name</span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={NAME_MAX}
            value={name}
            onChange={(event) => setNameDraft(event.target.value)}
            className="field mt-2 w-full"
            placeholder="Ada Lovelace"
          />
        </label>
        <label className="block">
          <span className="field-label">Handle</span>
          <span className="relative mt-2 block">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">@</span>
            <input
              name="handle"
              type="text"
              autoComplete="username"
              required
              minLength={HANDLE_MIN}
              maxLength={HANDLE_MAX}
              spellCheck={false}
              value={handle}
              onChange={(event) => setHandleDraft(normalizeHandleInput(event.target.value))}
              className="field w-full pl-7"
              placeholder="ada"
            />
          </span>
          <span className="mt-1.5 block text-xs text-muted">
            {handle ? `Anyone can open /${handle}.` : "3–20 characters. Letters, numbers, and underscores."}
          </span>
        </label>
        <button type="submit" disabled={pending} className="button-primary w-full justify-center">
          {pending ? "Saving…" : "Save profile"}
        </button>
        {error && (
          <p role="alert" className="rounded-xl border border-line bg-ink p-4 text-sm leading-relaxed text-paper">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
