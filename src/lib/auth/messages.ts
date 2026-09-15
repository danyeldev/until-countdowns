const FRIENDLY: Record<string, string> = {
  "Invalid login credentials": "That email or password is not right.",
  "Email not confirmed": "Confirm your email from the message we sent, then try again.",
  "User already registered": "An account with that email already exists. Sign in instead.",
  "Password should be at least 6 characters.": "Use a password with at least 6 characters.",
  "Signup requires a valid password": "Choose a password with at least 6 characters.",
  "Unable to validate email address: invalid format": "Enter a valid email address.",
  "Email rate limit exceeded": "Too many emails just now. Wait a minute and try again.",
  "over_email_send_rate_limit": "Too many emails just now. Wait a minute and try again.",
  "over_request_rate_limit": "Too many attempts just now. Wait a minute and try again.",
  "For security purposes, you can only request this after": "Wait a moment before requesting another email.",
  "New password should be different from the old password.": "Choose a password you have not used here before.",
  "Same password": "Choose a password you have not used here before.",
  "Provider is not enabled": "Google sign-in is not enabled for this project yet.",
  "Unsupported provider: provider is not enabled": "Google sign-in is not enabled for this project yet.",
  "validation_failed": "Check your email and password and try again.",
  "handle_taken": "That handle is taken. Try another.",
  "profiles_handle_unique": "That handle is taken. Try another.",
  "duplicate key value violates unique constraint": "That handle is taken. Try another.",
  user_not_found: "This sign-in is no longer valid. Sign in again.",
  session_not_found: "This sign-in is no longer valid. Sign in again.",
};

const RAW_INTERNALS = /https?:\/\/|regular expression|permission denied|violates|foreign key|constraint|insert or update on table/i;

export function isStaleAuthSession(error: { message?: string; code?: string } | string | null | undefined): boolean {
  if (!error) return false;
  const message = typeof error === "string" ? error : error.message?.trim() || "";
  const code = typeof error === "string" ? "" : error.code?.trim() || "";
  return (
    code === "user_not_found" ||
    code === "session_not_found" ||
    /user from sub claim in jwt does not exist/i.test(message) ||
    /user not found/i.test(message)
  );
}

export function authErrorMessage(error: { message?: string; code?: string } | string | null | undefined): string {
  if (!error) return "Something went wrong. Try again.";
  const message = typeof error === "string" ? error : error.message?.trim() || "";
  const code = typeof error === "string" ? "" : error.code?.trim() || "";
  if (isStaleAuthSession(error) || code === "23503" || /profiles_id_fkey/.test(message)) {
    return "This sign-in is no longer valid. Sign in again.";
  }
  if (code && FRIENDLY[code]) return FRIENDLY[code];
  if (message && FRIENDLY[message]) return FRIENDLY[message];
  for (const [needle, friendly] of Object.entries(FRIENDLY)) {
    if (message.includes(needle) || code.includes(needle)) return friendly;
  }
  if (message && message.length < 160 && !RAW_INTERNALS.test(message)) return message;
  return "Something went wrong. Try again.";
}

export const AUTH_COPY = {
  unavailable: "Sign in is not configured yet. Add the public Supabase URL and publishable key.",
  googleUnavailable: "Google sign-in is not enabled in the Supabase project yet.",
} as const;
