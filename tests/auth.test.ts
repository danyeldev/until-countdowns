import { describe, expect, it } from "vitest";
import { authErrorMessage, isStaleAuthSession } from "@/lib/auth/messages";
import { completeProfileHref, hasSupabaseAuthCookies, loginHref, parseAuthMode, safeNextPath } from "@/lib/auth/paths";
import { handleError, normalizeHandleInput, parseHandle, parseName, parseProfileParam, profileHref, readSignupProfile } from "@/lib/auth/profile";

describe("safeNextPath", () => {
  it("keeps in-app paths and query strings", () => {
    expect(safeNextPath("/saved")).toBe("/saved");
    expect(safeNextPath("/event/halloween-2027?from=search")).toBe("/event/halloween-2027?from=search");
    expect(safeNextPath("/login/update-password")).toBe("/login/update-password");
  });

  it("rejects off-site and looping destinations", () => {
    expect(safeNextPath("https://evil.example/phish")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/login/complete")).toBe("/");
    expect(safeNextPath("/auth/callback")).toBe("/");
    expect(safeNextPath("/auth/callback?next=/saved")).toBe("/");
    expect(safeNextPath("saved")).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath(["/saved", "/admin"])).toBe("/saved");
  });
});

describe("login helpers", () => {
  it("builds login links without leaking unsafe next values", () => {
    expect(loginHref("/")).toBe("/login");
    expect(loginHref("//evil.example")).toBe("/login");
    expect(loginHref("/saved", { mode: "signup" })).toBe("/login?next=%2Fsaved&mode=signup");
    expect(completeProfileHref("/")).toBe("/login/complete");
    expect(completeProfileHref("/saved")).toBe("/login/complete?next=%2Fsaved");
    expect(completeProfileHref("/login/complete")).toBe("/login/complete");
  });

  it("reads known auth modes only", () => {
    expect(parseAuthMode("signup")).toBe("signup");
    expect(parseAuthMode("reset")).toBe("reset");
    expect(parseAuthMode("admin")).toBe("signin");
  });

  it("encodes next once so an OAuth redirect_to still yields the in-app path", () => {
    const callback = new URL("/auth/callback", "http://localhost:3001");
    callback.searchParams.set("next", "/saved");
    const authorize = new URL("https://example.supabase.co/auth/v1/authorize");
    authorize.searchParams.set("redirect_to", callback.toString());
    expect(new URL(authorize.searchParams.get("redirect_to") ?? "").searchParams.get("next")).toBe("/saved");
  });

  it("detects supabase auth cookies without treating other cookies as a session", () => {
    expect(hasSupabaseAuthCookies([{ name: "sb-zgtowuglxtylpcjmqkqw-auth-token" }])).toBe(true);
    expect(hasSupabaseAuthCookies([{ name: "theme" }])).toBe(false);
  });
});

describe("authErrorMessage", () => {
  it("maps known supabase errors to short, non-technical copy", () => {
    expect(authErrorMessage({ message: "Invalid login credentials" })).toBe("That email or password is not right.");
    expect(authErrorMessage({ code: "over_email_send_rate_limit" })).toBe("Too many emails just now. Wait a minute and try again.");
    expect(authErrorMessage({ message: "Unsupported provider: provider is not enabled" })).toContain("Google");
    expect(authErrorMessage({ message: "handle_taken" })).toBe("That handle is taken. Try another.");
    expect(authErrorMessage({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe(
      "That handle is taken. Try another.",
    );
    expect(authErrorMessage({ code: "23503", message: 'insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"' })).toBe(
      "This sign-in is no longer valid. Sign in again.",
    );
  });

  it("treats a JWT whose Auth user is gone as a stale session", () => {
    expect(isStaleAuthSession({ message: "User from sub claim in JWT does not exist" })).toBe(true);
    expect(isStaleAuthSession({ code: "user_not_found" })).toBe(true);
    expect(isStaleAuthSession({ message: "Invalid login credentials" })).toBe(false);
  });

  it("does not echo URLs or empty internals", () => {
    expect(authErrorMessage({ message: "See https://evil.example/docs" })).toBe("Something went wrong. Try again.");
    expect(authErrorMessage({ message: 'insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"' })).toBe(
      "This sign-in is no longer valid. Sign in again.",
    );
    expect(authErrorMessage(null)).toBe("Something went wrong. Try again.");
  });
});

describe("signup profile", () => {
  it("accepts a display name and a unique-looking handle", () => {
    expect(parseName("  Ada   Lovelace ")).toBe("Ada Lovelace");
    expect(parseName("")).toBeNull();
    expect(parseHandle("Ada_Lovelace")).toBe("ada_lovelace");
    expect(parseHandle("ab")).toBeNull();
    expect(parseHandle("1ada")).toBeNull();
    expect(parseHandle("login")).toBeNull();
    expect(parseHandle("attributions")).toBeNull();
    expect(parseHandle("tag")).toBeNull();
    expect(handleError("login")).toMatch(/reserved/);
    expect(handleError("notifications")).toMatch(/reserved/);
    expect(handleError("collections")).toMatch(/reserved/);
    expect(normalizeHandleInput("Ada Lovelace!")).toBe("adalovelace");
    expect(readSignupProfile({ name: "Ada", handle: "ada" })).toEqual({ name: "Ada", handle: "ada" });
    expect(readSignupProfile({ name: "Ada", handle: "login" })).toBeNull();
    expect(parseProfileParam("@Ada_Lovelace")).toBe("ada_lovelace");
    expect(parseProfileParam("login")).toBeNull();
    expect(profileHref("Ada")).toBe("/ada");
    expect(profileHref("login")).toBe("/");
  });
});
