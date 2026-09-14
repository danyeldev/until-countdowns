import { connection } from "next/server";
import { redirect } from "next/navigation";
import { pad2, todayUtc, yearMonthOf } from "@/lib/seo";

/** The app navigation always opens the current month, including after a month rolls over. */
export default async function CalendarPage() {
  await connection();
  const { year, month } = yearMonthOf(todayUtc());
  redirect(`/calendar/${year}/${pad2(month)}`);
}
