import type { NextRequest } from "next/server";
import { getEvent, resolveSlugAlias } from "@/lib/catalog";
import { ogBackgroundUrl, shortCredit } from "@/lib/images";
import { CATEGORY_LABELS } from "@/lib/labels";
import { badRequest, CACHE_DATED, CACHE_UNDATED, daysBetween, parseOgDate, renderOgCard } from "@/lib/og";
import { expectedPeriod, formatLongDate } from "@/lib/seo";
import { isCoarsePrecision } from "@/lib/time";

export const runtime = "nodejs";

/**
 * `/og/event/<slug>/<yyyy-mm-dd>.png` — the date in the URL is the day the metadata was built,
 * so the day count is deterministic per URL and social scrapers refetch a new URL every day.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string; date: string }> }) {
  const { slug, date } = await ctx.params;
  const day = parseOgDate(date);
  if (!day) return badRequest("date must be YYYY-MM-DD or YYYY-MM-DD.png");

  let event = await getEvent(slug);
  if (!event) {
    const current = await resolveSlugAlias(slug);
    if (current) event = await getEvent(current);
  }
  if (!event) {
    return renderOgCard(
      { eyebrow: "Countdowns", title: "Until", subtitle: "Countdowns for everything coming", seed: "default" },
      CACHE_UNDATED,
    );
  }

  const coarse = isCoarsePrecision(event.datePrecision);
  // The card crops the photo and lays a scrim, the title and the wordmark over it — that is
  // Adapted Material, so a ShareAlike file gets no background here (brief §21 step 4) and the
  // seeded gradient is drawn instead. CC0 / PD / CC BY files keep the photo, with the credit.
  const background = ogBackgroundUrl(event.image);
  const status = event.status === "cancelled" ? "Cancelled · " : event.status === "postponed" ? "Postponed · " : "";
  return renderOgCard(
    {
      eyebrow: CATEGORY_LABELS[event.category],
      title: event.title,
      subtitle: coarse ? undefined : `${status}${formatLongDate(event.date)}`,
      days: coarse ? null : daysBetween(day, event.date, event.allDay),
      expectedLabel: coarse ? `expected ${expectedPeriod(event.date, event.datePrecision)}` : undefined,
      // The stored `og.jpg` derivative is already 1200x630: no cropping happens at render time.
      imageUrl: background,
      imageCredit: background && event.image ? shortCredit(event.image) : null,
      seed: event.slug,
    },
    CACHE_DATED,
  );
}
