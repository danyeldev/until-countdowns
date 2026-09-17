"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { unstable_rethrow } from "next/navigation";
import { completeProfileAction } from "@/lib/auth/actions";
import { authErrorMessage } from "@/lib/auth/messages";
import { NAME_MAX, SIGNUP_PROFILE_KEY, readSignupProfile } from "@/lib/auth/profile";
import { HandleField } from "./HandleField";

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
      <form aria-label="Complete your profile" className="mt-8 space-y-5" onSubmit={(event) => void onSubmit(event)}>
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
        <HandleField
          value={handle}
          onChange={setHandleDraft}
          hint={handle ? `Anyone can open /${handle}.` : "3–20 characters. Letters, numbers, and underscores."}
        />
        <button type="submit" disabled={pending} className="button-primary w-full justify-center">
          {pending ? "Saving…" : "Save profile"}
        </button>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
