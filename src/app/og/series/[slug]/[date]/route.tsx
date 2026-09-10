import type { NextRequest } from "next/server";
import { getSeries, resolveSeriesAlias } from "@/lib/catalog";
import { CATEGORY_LABELS } from "@/lib/labels";
import { badRequest, CACHE_DATED, CACHE_UNDATED, daysBetween, parseOgDate, renderOgCard } from "@/lib/og";
import { longDate } from "@/lib/i18n/format";
import { EN } from "@/lib/i18n/localized";
import { formatApproximate } from "@/lib/seo";
import { isCoarsePrecision } from "@/lib/time";

export const runtime = "nodejs";

/** `/og/series/<slug>/<yyyy-mm-dd>.png` — next occurrence of a series, day count fixed per URL. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string; date: string }> }) {
  const { slug, date } = await ctx.params;
  const day = parseOgDate(date);
  if (!day) return badRequest("date must be YYYY-MM-DD or YYYY-MM-DD.png");

  let series = await getSeries(slug);
  if (!series) {
    const canonical = await resolveSeriesAlias(slug);
    if (canonical) series = await getSeries(canonical);
  }
  if (!series) {
    return renderOgCard(
      { eyebrow: "Countdowns", title: "Until", subtitle: "Countdowns for everything coming", seed: "default" },
      CACHE_UNDATED,
    );
  }

  const coarse = isCoarsePrecision(series.nextPrecision);
  const next = series.nextDate;
  return renderOgCard(
    {
      eyebrow: `${CATEGORY_LABELS[series.category]} · every year`,
      title: series.title,
      subtitle: next && !coarse ? `Next: ${longDate("en", next)}` : next ? undefined : "Dates to be announced",
      days: next && !coarse ? daysBetween(day, next, series.nextAllDay ?? true) : null,
      expectedLabel: next && coarse ? formatApproximate(EN, next, series.nextPrecision) : undefined,
      seed: `series:${series.slug}`,
    },
    CACHE_DATED,
  );
}
