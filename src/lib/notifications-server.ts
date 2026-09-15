import "server-only";
import { createAuthServerClient } from "@/lib/auth/server";
import { listUserNotifications } from "@/lib/notifications-client";
import type { UserNotification } from "@/lib/notifications";

export async function listOwnNotifications(): Promise<UserNotification[]> {
  return listUserNotifications(await createAuthServerClient());
}
