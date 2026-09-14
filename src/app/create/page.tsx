import { CreateForm } from "@/components/CreateForm";
import { MineList } from "@/components/MineList";
import { buildMetadata, todayUtc } from "@/lib/seo";
import { shiftDay } from "@/lib/time";
import { connection } from "next/server";

export const metadata = buildMetadata({
  title: "Create a free countdown",
  description:
    "Make a personal countdown for a birthday, trip, launch or any date. Save it on this device, share a link and add it to your calendar.",
  canonical: "/create",
  ogPath: "/og/default",
});

export default async function CreatePage() {
  await connection();
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
