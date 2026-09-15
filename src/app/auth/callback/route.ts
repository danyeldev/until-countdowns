import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { isAuthConfigured } from "@/lib/auth/env";
import { authErrorMessage } from "@/lib/auth/messages";
import { completeProfileHref, loginHref, safeNextPath, UPDATE_PASSWORD_PATH } from "@/lib/auth/paths";
import { createAuthServerClient, getOwnProfile, profileIsComplete } from "@/lib/auth/server";

const OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && OTP_TYPES.includes(value as EmailOtpType);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const oauthError = searchParams.get("error_description") || searchParams.get("error");

  if (!isAuthConfigured()) {
    redirect(loginHref(next, { error: "Sign in is not configured yet." }));
  }

  if (oauthError) {
    redirect(loginHref(next, { error: authErrorMessage(oauthError) }));
  }

  const supabase = await createAuthServerClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) redirect(loginHref(next, { error: authErrorMessage(error) }));
    if (type === "recovery") redirect(UPDATE_PASSWORD_PATH);
    if (!profileIsComplete(await getOwnProfile())) redirect(completeProfileHref(next));
    redirect(next);
  }

  if (tokenHash && isOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) redirect(loginHref(next, { error: authErrorMessage(error) }));
    if (type === "recovery") redirect(UPDATE_PASSWORD_PATH);
    if (!profileIsComplete(await getOwnProfile())) redirect(completeProfileHref(next));
    redirect(next);
  }

  redirect(loginHref(next, { error: "Could not complete sign in. Try again." }));
}
