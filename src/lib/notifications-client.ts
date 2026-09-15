import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import {
  NOTIFICATIONS_PAGE_MAX,
  type UserNotification,
  notificationErrorMessage,
  parseNotificationKind,
  previewCommentBody,
} from "./notifications";

type NotificationClient = SupabaseClient<Database>;

type NotificationRow = {
  id: string;
  kind: string;
  event_key: string;
  comment_id: string;
  read_at: string | null;
  created_at: string;
  actor_id: string;
  profiles: { name: string; handle: string | null } | { name: string; handle: string | null }[] | null;
  event_comments: { body: string } | { body: string }[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function notificationFromRow(row: NotificationRow): UserNotification | null {
  const kind = parseNotificationKind(row.kind);
  const profile = first(row.profiles);
  const handle = profile?.handle?.trim() || "";
  if (!kind || !handle) return null;
  return {
    id: row.id,
    kind,
    eventKey: row.event_key,
    commentId: row.comment_id,
    preview: previewCommentBody(first(row.event_comments)?.body ?? ""),
    createdAt: row.created_at,
    readAt: row.read_at,
    actor: {
      id: row.actor_id,
      name: profile?.name?.trim() || handle,
      handle,
    },
  };
}

export async function listUserNotifications(client: NotificationClient): Promise<UserNotification[]> {
  const { data, error } = await client
    .from("notifications")
    .select(
      "id, kind, event_key, comment_id, read_at, created_at, actor_id, profiles!notifications_actor_id_fkey(name, handle), event_comments(body)",
    )
    .order("created_at", { ascending: false })
    .limit(NOTIFICATIONS_PAGE_MAX);
  if (error) throw new Error(notificationErrorMessage(error));
  return ((data ?? []) as NotificationRow[]).flatMap((row) => {
    const item = notificationFromRow(row);
    return item ? [item] : [];
  });
}

export async function markNotificationsRead(
  client: NotificationClient,
  ids?: string[],
): Promise<void> {
  let query = client.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (ids?.length) query = query.in("id", ids);
  const { error } = await query;
  if (error) throw new Error(notificationErrorMessage(error));
}
