import { CreateForm } from "@/components/CreateForm";
import { MineList } from "@/components/MineList";
import { requireAuth } from "@/lib/auth/server";
import { todayUtc, localizedMetadata } from "@/lib/seo";
import { shiftDay } from "@/lib/time";

export async function generateMetadata() {
  return localizedMetadata({
  title: "Create a free countdown",
  description:
    "Make a personal countdown for a birthday, trip, launch or any date. Sign in to save it, share a link and add it to your calendar.",
  canonical: "/create",
  ogPath: "/og/default",
});
}

export default async function CreatePage() {
  await requireAuth("/create");
  return (
    <div>
      <h1 className="page-heading">Make a little anticipation.</h1>
      <p className="page-subtitle mt-3 max-w-xl">Your next adventure, big day, or fresh start. Give it a countdown.</p>
      <div className="mt-8">
        <CreateForm defaultDate={shiftDay(todayUtc(), 1)} />
      </div>
      <MineList />
    </div>
  );
}
