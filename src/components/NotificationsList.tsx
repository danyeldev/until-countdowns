"use client";

import { Link } from "@/i18n/navigation";
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
        <ol className="divide-y divide-line">
          {shown.map((item) => {
            const href = notificationHref(item.eventKey, item.commentId);
            return (
              <li key={item.id}>
                <Link
                  href={href}
                  onClick={() => void markRead([item.id])}
                  className="group block py-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className={`flex items-baseline gap-2 text-sm ${item.readAt ? "text-paper-dim" : "text-paper"}`}>
                      {!item.readAt ? (
                        <span aria-hidden="true" className="size-1.5 shrink-0 self-center rounded-full bg-amber" />
                      ) : null}
                      <span>
                      {notificationCopy(item.kind, item.actor.name)}{" "}
                      <span className="text-muted">
                        @
                        <span className="text-amber">{item.actor.handle}</span>
                      </span>
                      </span>
                    </p>
                    <time className="text-xs text-muted" dateTime={item.createdAt}>
                      {formatTime(item.createdAt)}
                    </time>
                  </div>
                  {item.preview ? <p className="mt-2 text-sm leading-relaxed text-paper-dim">{item.preview}</p> : null}
                  <p className="mt-2 text-xs text-muted group-hover:text-amber">Open conversation</p>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="empty-state text-sm leading-relaxed">
          When someone replies to you or tags your handle, it will land here.
        </p>
      )}
    </div>
  );
}
