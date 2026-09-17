"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { useCollection } from "@/components/CollectionProvider";
import { useNotifications } from "@/components/NotificationsProvider";
import { Icon } from "./Icon";

export function NotificationBell() {
  const pathname = usePathname();
  const { userId } = useCollection();
  const { unread } = useNotifications();
  const current = pathname.startsWith("/notifications");
  if (!userId) return null;
  const label = unread ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "Notifications";

  return (
    <Link
      href="/notifications"
      aria-current={current ? "page" : undefined}
      aria-label={label}
      className="icon-button relative"
    >
      <Icon name="bell" size={16} />
      {unread > 0 ? (
        <span className="absolute end-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-amber px-1 text-[10px] font-medium leading-4 text-[#171222]">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
