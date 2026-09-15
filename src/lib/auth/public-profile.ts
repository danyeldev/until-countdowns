import "server-only";
import { anonClient, supabaseEnv } from "@/lib/db/client";
import { parseProfileParam } from "./profile";

export type PublicProfile = { name: string; handle: string; createdAt: string };

export async function getPublicProfile(value: unknown): Promise<PublicProfile | null> {
  const handle = parseProfileParam(value);
  if (!handle || !supabaseEnv()) return null;
  const { data } = await anonClient()
    .from("profiles")
    .select("name, handle, created_at")
    .eq("handle", handle)
    .maybeSingle();
  if (!data?.handle) return null;
  const name = data.name.trim() || `@${data.handle}`;
  return { name, handle: data.handle, createdAt: data.created_at };
}
