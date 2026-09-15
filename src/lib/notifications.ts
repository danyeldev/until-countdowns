import { parseCommentEventKey } from "./comments";

export const NOTIFICATIONS_PAGE_MAX = 50;
export const NOTIFICATION_PREVIEW_MAX = 140;

export const NOTIFICATION_KINDS = ["comment_reply", "comment_mention"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type NotificationActor = {
  id: string;
  name: string;
  handle: string;
};

export type UserNotification = {
  id: string;
  kind: NotificationKind;
  eventKey: string;
  commentId: string;
  preview: string;
  createdAt: string;
  readAt: string | null;
  actor: NotificationActor;
};

export function parseNotificationKind(value: unknown): NotificationKind | null {
  return NOTIFICATION_KINDS.includes(value as NotificationKind) ? (value as NotificationKind) : null;
}

export function notificationHref(eventKey: string, commentId: string): string {
  const key = parseCommentEventKey(eventKey);
  if (!key || !commentId) return "/notifications";
  return `/event/${key}#comment-${commentId}`;
}

export function notificationCopy(kind: NotificationKind, actorName: string): string {
  const name = actorName.trim() || "Someone";
  if (kind === "comment_reply") return `${name} replied to your comment`;
  return `${name} mentioned you`;
}

export function previewCommentBody(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= NOTIFICATION_PREVIEW_MAX) return clean;
  return `${clean.slice(0, NOTIFICATION_PREVIEW_MAX - 1).trimEnd()}…`;
}

export function unreadNotificationCount(items: UserNotification[]): number {
  return items.reduce((count, item) => (item.readAt ? count : count + 1), 0);
}

export function notificationErrorMessage(error: { message?: string; code?: string } | string | null | undefined): string {
  if (!error) return "Could not load notifications.";
  const message = typeof error === "string" ? error : error.message?.trim() || "";
  const code = typeof error === "string" ? "" : error.code?.trim() || "";
  if (code === "42501" || /not authenticated|JWT/i.test(message)) return "Sign in to see your notifications.";
  if (message && message.length < 160 && !/https?:\/\//i.test(message) && !/regular expression|permission denied|violates/i.test(message)) {
    return message;
  }
  return "Could not load notifications.";
}
