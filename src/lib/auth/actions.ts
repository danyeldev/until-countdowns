"use server";

import { redirect } from "next/navigation";
import { authCallbackUrl } from "./origin";
import { authErrorMessage } from "./messages";
import { DEFAULT_AFTER_AUTH_PATH, UPDATE_PASSWORD_PATH, safeNextPath } from "./paths";
import { handleError, nameError, parseHandle, parseName } from "./profile";
import { ANALYTICS_EVENTS } from "@/lib/analytics-shared";
import { captureServer } from "@/lib/analytics-server";
import { createAuthServerClient } from "./server";
import { isAuthConfigured } from "./env";

const EMAIL_MAX = 254;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 72;

function readEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX || !email.includes("@") || email.includes(" ")) return null;
  return email;
}

function readPassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) return null;
  return value;
}

function profileWriteError(error: { message?: string; code?: string } | null): string {
  if (error?.code === "23505") return "That handle is taken. Try another.";
  return authErrorMessage(error);
}

async function assertHandleAvailable(handle: string, exceptUserId?: string): Promise<string | null> {
  const supabase = await createAuthServerClient();
  if (exceptUserId) {
    const { data: own } = await supabase.from("profiles").select("handle").eq("id", exceptUserId).maybeSingle();
    if (own?.handle === handle) return null;
  }
  const { data, error } = await supabase.rpc("handle_available", { p_handle: handle });
  if (error) return authErrorMessage(error);
  if (data === false) return "That handle is taken. Try another.";
  return null;
}

export async function signInWithPasswordAction(formData: FormData): Promise<{ error: string }> {
  if (!isAuthConfigured()) return { error: "Sign in is not configured yet." };
  const email = readEmail(formData.get("email"));
  const password = readPassword(formData.get("password"));
  const next = safeNextPath(formData.get("next"));
  if (!email) return { error: "Enter a valid email address." };
  if (!password) return { error: `Use a password with at least ${PASSWORD_MIN} characters.` };

  const supabase = await createAuthServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error) };
  redirect(next);
}

export async function signUpWithPasswordAction(
  formData: FormData,
): Promise<{ error: string } | { message: string }> {
  if (!isAuthConfigured()) return { error: "Sign in is not configured yet." };
  const name = parseName(formData.get("name"));
  const handle = parseHandle(formData.get("handle"));
  const email = readEmail(formData.get("email"));
  const password = readPassword(formData.get("password"));
  const confirm = typeof formData.get("confirm") === "string" ? formData.get("confirm") : "";
  const next = safeNextPath(formData.get("next"));
  if (!name) return { error: nameError(formData.get("name")) ?? "Enter your name." };
  if (!handle) return { error: handleError(formData.get("handle")) ?? "Choose a handle." };
  if (!email) return { error: "Enter a valid email address." };
  if (!password) return { error: `Use a password with at least ${PASSWORD_MIN} characters.` };
  if (password !== confirm) return { error: "Those passwords do not match." };
  const taken = await assertHandleAvailable(handle);
  if (taken) return { error: taken };

  const supabase = await createAuthServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: await authCallbackUrl(next),
      data: { full_name: name, handle },
    },
  });
  if (error) return { error: profileWriteError(error) };
  if (data.user?.id) {
    await captureServer(data.user.id, ANALYTICS_EVENTS.userSignedUp, {
      method: "email",
      handle,
      $set: { email, name, handle },
    });
  }
  if (!data.session) {
    return { message: "Check your email to confirm your account. Then you can sign in." };
  }
  redirect(next);
}

export async function resetPasswordAction(formData: FormData): Promise<{ error: string } | { message: string }> {
  if (!isAuthConfigured()) return { error: "Sign in is not configured yet." };
  const email = readEmail(formData.get("email"));
  if (!email) return { error: "Enter a valid email address." };

  const supabase = await createAuthServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await authCallbackUrl(UPDATE_PASSWORD_PATH),
  });
  if (error) return { error: authErrorMessage(error) };
  return { message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePasswordAction(formData: FormData): Promise<{ error: string }> {
  if (!isAuthConfigured()) return { error: "Sign in is not configured yet." };
  const password = readPassword(formData.get("password"));
  const confirm = typeof formData.get("confirm") === "string" ? formData.get("confirm") : "";
  if (!password) return { error: `Use a password with at least ${PASSWORD_MIN} characters.` };
  if (password !== confirm) return { error: "Those passwords do not match." };

  const supabase = await createAuthServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authErrorMessage(error) };
  redirect(DEFAULT_AFTER_AUTH_PATH);
}

export async function completeProfileAction(formData: FormData): Promise<{ error: string }> {
  if (!isAuthConfigured()) return { error: "Sign in is not configured yet." };
  const supabase = await createAuthServerClient();
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: "This sign-in is no longer valid. Sign in again." };
  }
  const name = parseName(formData.get("name"));
  const handle = parseHandle(formData.get("handle"));
  const next = safeNextPath(formData.get("next"));
  if (!name) return { error: nameError(formData.get("name")) ?? "Enter your name." };
  if (!handle) return { error: handleError(formData.get("handle")) ?? "Choose a handle." };
  const taken = await assertHandleAvailable(handle, data.user.id);
  if (taken) return { error: taken };

  const { error } = await supabase.from("profiles").upsert(
    { id: data.user.id, name, handle },
    { onConflict: "id" },
  );
  if (error) return { error: profileWriteError(error) };
  await supabase.auth.updateUser({ data: { full_name: name, handle } });
  if (data.user.app_metadata?.provider === "google") {
    await captureServer(data.user.id, ANALYTICS_EVENTS.userSignedUp, {
      method: "google",
      handle,
      $set: { name, handle, email: data.user.email },
    });
  }
  redirect(next);
}

export async function signOutAction() {
  if (isAuthConfigured()) {
    const supabase = await createAuthServerClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect(DEFAULT_AFTER_AUTH_PATH);
}
