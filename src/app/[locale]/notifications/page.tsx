import { NotificationsList } from "@/components/NotificationsList";
import { requireAuth } from "@/lib/auth/server";
import { listOwnNotifications } from "@/lib/notifications-server";
import { localizedMetadata } from "@/lib/seo";

export async function generateMetadata() {
  return localizedMetadata({
  title: "Notifications",
  description: "Replies and mentions from countdown conversations, kept with your Until account.",
  canonical: "/notifications",
  ogPath: "/og/default",
  noindex: true,
});
}

export default async function NotificationsPage() {
  await requireAuth("/notifications");
  const initialItems = await listOwnNotifications();
  return (
    <div>
      <div className="mb-8">
        <h1 className="page-heading">Notifications</h1>
        <p className="page-subtitle mt-3 max-w-xl">
          Replies and @mentions from conversations you are part of.
        </p>
      </div>
      <NotificationsList initialItems={initialItems} />
    </div>
  );
}
