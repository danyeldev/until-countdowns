"use client";

import { useState, type FormEvent } from "react";
import { unstable_rethrow } from "next/navigation";
import { updatePasswordAction } from "@/lib/auth/actions";
import { authErrorMessage } from "@/lib/auth/messages";

export function UpdatePasswordForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError("");
    setPending(true);
    try {
      const result = await updatePasswordAction(new FormData(formEvent.currentTarget));
      if (result?.error) setError(result.error);
    } catch (cause) {
      unstable_rethrow(cause);
      setError(cause instanceof Error ? authErrorMessage(cause.message) : "Could not update your password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="page-heading">Choose a new password.</h1>
      <p className="page-subtitle mt-3">Use at least 6 characters. You will stay signed in on this device.</p>
      <form aria-label="Set a new password" className="mt-8 space-y-5" onSubmit={(event) => void onSubmit(event)}>
        <label className="block">
          <span className="field-label">New password</span>
          <input name="password" type="password" autoComplete="new-password" required minLength={6} maxLength={72} className="field mt-2 w-full" />
        </label>
        <label className="block">
          <span className="field-label">Confirm password</span>
          <input name="confirm" type="password" autoComplete="new-password" required minLength={6} maxLength={72} className="field mt-2 w-full" />
        </label>
        <button type="submit" disabled={pending} className="button-primary w-full justify-center">
          {pending ? "Saving…" : "Update password"}
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
