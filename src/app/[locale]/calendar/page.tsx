import { connection } from "next/server";
import { localeOf } from "@/i18n/locales";
import { redirect } from "@/i18n/navigation";
import { pad2, todayUtc, yearMonthOf } from "@/lib/seo";

/** The app navigation always opens the current month, including after a month rolls over. */
export default async function CalendarPage({ params }: { params: Promise<{ locale: string }> }) {
  await connection();
  const { locale } = await params;
  const { year, month } = yearMonthOf(todayUtc());
  redirect({ href: `/calendar/${year}/${pad2(month)}`, locale: localeOf(locale) });
}
