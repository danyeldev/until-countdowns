"use client";

import Link from "next/link";
import { useCollection } from "@/components/CollectionProvider";
import { useNotifications } from "@/components/NotificationsProvider";
import { notificationCopy, notificationHref, unreadNotificationCount, type UserNotification } from "@/lib/notifications";

function formatTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function NotificationsList({ initialItems }: { initialItems: UserNotification[] }) {
  const { userId } = useCollection();
  const { ready, items, unread, markRead } = useNotifications();
  const shown = userId && ready ? items : initialItems;
  const shownUnread = userId && ready ? unread : unreadNotificationCount(initialItems);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {shownUnread ? `${shownUnread} unread` : shown.length ? "You're caught up." : "No notifications yet."}
        </p>
        {shownUnread ? (
          <button type="button" className="button-secondary !min-h-11 !text-xs" onClick={() => void markRead()}>
            Mark all as read
          </button>
        ) : null}
      </div>

      {shown.length ? (
        <ol className="space-y-3">
          {shown.map((item) => {
            const href = notificationHref(item.eventKey, item.commentId);
            return (
              <li key={item.id}>
                <Link
                  href={href}
                  onClick={() => void markRead([item.id])}
                  className={`block rounded-2xl border px-4 py-4 transition-colors sm:px-5 ${
                    item.readAt ? "border-line bg-ink" : "border-amber/35 bg-amber/[.06]"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm text-paper">
                      {notificationCopy(item.kind, item.actor.name)}{" "}
                      <span className="text-muted">
                        @
                        <span className="text-amber">{item.actor.handle}</span>
                      </span>
                    </p>
                    <time className="text-xs text-muted" dateTime={item.createdAt}>
                      {formatTime(item.createdAt)}
                    </time>
                  </div>
                  {item.preview ? <p className="mt-2 text-sm leading-relaxed text-paper-dim">{item.preview}</p> : null}
                  <p className="mt-3 text-xs text-muted">Open conversation</p>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-2xl border border-line bg-ink-2 px-5 py-6 text-sm leading-relaxed text-paper-dim">
          When someone replies to you or tags your handle, it will land here.
        </p>
      )}
    </div>
  );
}
