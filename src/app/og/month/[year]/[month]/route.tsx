import type { NextRequest } from "next/server";
import { badRequest, CACHE_UNDATED, renderOgCard } from "@/lib/og";
import { CALENDAR_MAX_YEAR, CALENDAR_MIN_YEAR, monthLabel } from "@/lib/seo";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ year: string; month: string }> }) {
  const params = await ctx.params;
  const year = Number(params.year);
  const month = Number(params.month.replace(/\.png$/, ""));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return badRequest("Use /og/month/YYYY/MM");
  if (year < CALENDAR_MIN_YEAR || year > CALENDAR_MAX_YEAR) return new Response("Year out of range", { status: 404 });
  return renderOgCard(
    {
      eyebrow: "Calendar",
      title: monthLabel(year, month),
      subtitle: "What is coming up, day by day",
      seed: `month:${year}-${month}`,
    },
    CACHE_UNDATED,
  );
}
