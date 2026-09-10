import { CreateForm } from "@/components/CreateForm";
import { MineList } from "@/components/MineList";

export const metadata = {
  title: "Create a countdown",
  description: "Make a personal countdown and add it to your calendar.",
};

export default function CreatePage() {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.24em] text-amber">Your dates</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">Make a countdown</h1>
      <p className="mt-4 max-w-2xl text-paper-dim">
        Birthdays, launches, a trip, a court date, a reunion. It ticks the same as the catalog — and you can drop it
        straight into Google Calendar, Outlook, or an .ics file.
      </p>
      <div className="mt-10">
        <CreateForm />
      </div>
      <MineList />
    </div>
  );
}
