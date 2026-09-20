"use client";

import { Link } from "@/i18n/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import {
  resetPasswordAction,
  signInWithPasswordAction,
  signUpWithPasswordAction,
} from "@/lib/auth/actions";
import { createAuthBrowserClient } from "@/lib/auth/browser";
import { isAuthConfigured } from "@/lib/auth/env";
import { AUTH_COPY, authErrorMessage } from "@/lib/auth/messages";
import { loginHref, type AuthMode } from "@/lib/auth/paths";
import { NAME_MAX, SIGNUP_PROFILE_KEY, handleError, nameError, parseHandle, parseName } from "@/lib/auth/profile";
import { captureException, identifyUser } from "@/lib/analytics";
import { HandleField } from "./HandleField";

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

const TITLES: Record<AuthMode, { heading: string; subtitle: string; submit: string }> = {
  signin: {
    heading: "Pick up where you left off.",
    subtitle: "Sign in with Google or your email to save dates and create countdowns.",
    submit: "Sign in",
  },
  signup: {
    heading: "Make a place for what’s next.",
    subtitle: "Add your name and a handle, then continue with Google or email.",
    submit: "Create account",
  },
  reset: {
    heading: "Reset your password.",
    subtitle: "We’ll send a link to the email on your account.",
    submit: "Send reset link",
  },
};

export function AuthForm({
  mode,
  next,
  initialError = "",
  initialMessage = "",
  layout = "page",
  headingId,
  dialogHeading,
  dialogSubtitle,
  onModeChange,
}: {
  mode: AuthMode;
  next: string;
  initialError?: string;
  initialMessage?: string;
  layout?: "page" | "dialog";
  headingId?: string;
  dialogHeading?: string;
  dialogSubtitle?: string;
  onModeChange?: (mode: AuthMode) => void;
}) {
  const configured = isAuthConfigured();
  const copy = layout === "dialog" && mode === "signin"
    ? {
        heading: dialogHeading ?? "Sign in to continue.",
        subtitle: dialogSubtitle ?? "Use Google or your email.",
        submit: TITLES.signin.submit,
      }
    : TITLES[mode];
  const Heading = layout === "dialog" ? "h2" : "h1";
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState(initialMessage);
  const [pending, setPending] = useState<"google" | "email" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");

  async function rememberSignupProfile(): Promise<{ ok: true; name: string; handle: string } | { ok: false; error: string }> {
    const parsedName = parseName(name);
    const parsedHandle = parseHandle(handle);
    if (!parsedName) return { ok: false, error: nameError(name) ?? "Enter your name." };
    if (!parsedHandle) return { ok: false, error: handleError(handle) ?? "Choose a handle." };
    try {
      const supabase = createAuthBrowserClient();
      const { data: available, error: availabilityError } = await supabase.rpc("handle_available", {
        p_handle: parsedHandle,
      });
      if (availabilityError) return { ok: false, error: authErrorMessage(availabilityError) };
      if (available === false) return { ok: false, error: "That handle is taken. Try another." };
      sessionStorage.setItem(SIGNUP_PROFILE_KEY, JSON.stringify({ name: parsedName, handle: parsedHandle }));
    } catch (cause) {
      return {
        ok: false,
        error: cause instanceof Error ? authErrorMessage(cause.message) : "Could not check that handle.",
      };
    }
    return { ok: true, name: parsedName, handle: parsedHandle };
  }

  async function onGoogle() {
    setError("");
    setMessage("");
    if (!configured) {
      setError(AUTH_COPY.unavailable);
      return;
    }
    if (mode === "signup") {
      const remembered = await rememberSignupProfile();
      if (!remembered.ok) {
        setError(remembered.error);
        return;
      }
    }
    setPending("google");
    try {
      const supabase = createAuthBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: (() => {
            const callback = new URL("/auth/callback", window.location.origin);
            if (next && next !== "/") callback.searchParams.set("next", next);
            return callback.toString();
          })(),
        },
      });
      if (oauthError) setError(authErrorMessage(oauthError));
    } catch (cause) {
      captureException(cause, { action: "signup_google" });
      setError(cause instanceof Error ? authErrorMessage(cause.message) : AUTH_COPY.googleUnavailable);
    } finally {
      setPending(null);
    }
  }

  async function onEmail(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError("");
    setMessage("");
    setPending("email");
    const formData = new FormData(formEvent.currentTarget);
    formData.set("next", next);
    if (mode === "signup") {
      const remembered = await rememberSignupProfile();
      if (!remembered.ok) {
        setError(remembered.error);
        setPending(null);
        return;
      }
      formData.set("name", remembered.name);
      formData.set("handle", remembered.handle);
      const email = String(formData.get("email") ?? "").trim().toLowerCase();
      if (email) identifyUser(email, { email, name: remembered.name, handle: remembered.handle });
    }
    try {
      const result =
        mode === "signup"
          ? await signUpWithPasswordAction(formData)
          : mode === "reset"
            ? await resetPasswordAction(formData)
            : await signInWithPasswordAction(formData);
      if ("error" in result) setError(result.error);
      if ("message" in result) setMessage(result.message);
    } catch (cause) {
      unstable_rethrow(cause);
      captureException(cause, { action: mode === "signup" ? "signup_email" : mode });
      setError(cause instanceof Error ? authErrorMessage(cause.message) : "Something went wrong. Try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={layout === "dialog" ? "w-full" : "mx-auto w-full max-w-md"}>
      <Heading id={headingId} className={layout === "dialog" ? "pr-10 text-2xl font-semibold tracking-tight text-pretty" : "page-heading"}>
        {copy.heading}
      </Heading>
      <p className={layout === "dialog" ? "mt-2 text-sm leading-relaxed text-muted" : "page-subtitle mt-3"}>
        {copy.subtitle}
      </p>
      <div className={layout === "dialog" ? "mt-6 space-y-5" : "panel mt-8 space-y-6 p-5 sm:p-7"}>
        {!configured && (
          <p role="status" className="rounded-xl border border-line bg-ink p-4 text-sm leading-relaxed text-paper">
            {AUTH_COPY.unavailable}
          </p>
        )}
        {mode === "signup" && (
          <div className="space-y-5">
            <label className="block">
              <span className="field-label">Name</span>
              <input
                name="name"
                type="text"
                autoComplete="name"
                required
                maxLength={NAME_MAX}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="field mt-2 w-full"
                placeholder="Ada Lovelace"
              />
            </label>
            <HandleField
              value={handle}
              onChange={setHandle}
              hint={handle ? `Your public page will be /${handle}.` : "3–20 characters. This becomes your public page."}
            />
          </div>
        )}
        {mode !== "reset" && (
          <>
            <button
              type="button"
              onClick={() => void onGoogle()}
              disabled={!configured || pending !== null}
              className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-[#171222] transition hover:bg-[#f4f5f8] disabled:opacity-50"
            >
              <GoogleMark />
              {pending === "google" ? "Redirecting to Google…" : "Continue with Google"}
            </button>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-line" />
              or use email
              <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}
        <form aria-label={copy.submit} className="space-y-5" onSubmit={(event) => void onEmail(event)}>
          {mode === "signup" && (
            <>
              <input type="hidden" name="name" value={name} />
              <input type="hidden" name="handle" value={handle} />
            </>
          )}
          <label className="block">
            <span className="field-label">Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              className="field mt-2 w-full"
              placeholder="you@example.com"
            />
          </label>
          {mode !== "reset" && (
            <div className="relative">
              <label className="block">
                <span className="field-label">Password</span>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={6}
                  maxLength={72}
                  className="field mt-2 w-full pr-20"
                />
              </label>
              <button
                type="button"
                className="absolute bottom-0 right-2 flex h-12 items-center rounded-lg px-3 text-xs text-muted hover:text-paper"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          )}
          {mode === "signup" && (
            <label className="block">
              <span className="field-label">Confirm password</span>
              <input
                name="confirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                maxLength={72}
                className="field mt-2 w-full"
              />
            </label>
          )}
          <button type="submit" disabled={!configured || pending !== null} className="button-primary w-full justify-center">
            {pending === "email" ? "Working…" : copy.submit}
          </button>
        </form>
        {error && (
          <p role="alert" className="rounded-xl border border-line bg-ink p-4 text-sm leading-relaxed text-paper">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="rounded-xl border border-amber/25 bg-amber/10 p-4 text-sm leading-relaxed text-paper">
            {message}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-sm">
          {mode === "signin" ? (
            <>
              <AuthModeLink
                href={loginHref(next, { mode: "signup" })}
                className="text-paper-dim hover:text-amber"
                onSelect={onModeChange ? () => onModeChange("signup") : undefined}
              >
                Create an account
              </AuthModeLink>
              <AuthModeLink
                href={loginHref(next, { mode: "reset" })}
                className="text-muted hover:text-paper"
                onSelect={onModeChange ? () => onModeChange("reset") : undefined}
              >
                Forgot password
              </AuthModeLink>
            </>
          ) : (
            <AuthModeLink
              href={loginHref(next)}
              className="text-paper-dim hover:text-amber"
              onSelect={onModeChange ? () => onModeChange("signin") : undefined}
            >
              Back to sign in
            </AuthModeLink>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthModeLink({
  href,
  className,
  onSelect,
  children,
}: {
  href: string;
  className: string;
  onSelect?: () => void;
  children: ReactNode;
}) {
  if (onSelect) {
    return (
      <button type="button" className={className} onClick={onSelect}>
        {children}
      </button>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
