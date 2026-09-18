import { getEvent, resolveSlugAlias } from "@/lib/catalog";
import { ogBackgroundUrl, shortCredit } from "@/lib/images";
import { CATEGORY_LABELS } from "@/lib/labels";
import { CACHE_UNDATED, daysBetween, renderOgCard } from "@/lib/og";
import { expectedPeriod, formatLongDate, todayUtc } from "@/lib/seo";
import { isCoarsePrecision } from "@/lib/time";

export const runtime = "nodejs";

/** Undated fallback used by scrapers that omit the daily date segment. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const day = todayUtc();
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
  const background = ogBackgroundUrl(event.image);
  const status = event.status === "cancelled" ? "Cancelled · " : event.status === "postponed" ? "Postponed · " : "";
  return renderOgCard(
    {
      eyebrow: CATEGORY_LABELS[event.category],
      title: event.title,
      subtitle: coarse ? undefined : `${status}${formatLongDate(event.date, event.timezone)}`,
      days: coarse || status ? null : daysBetween(day, event.date, event.allDay, event.timezone),
      expectedLabel: status ? status.replace(/ · $/, "") : coarse ? `expected ${expectedPeriod(event.date, event.datePrecision)}` : undefined,
      imageUrl: background,
      imageCredit: background && event.image ? shortCredit(event.image) : null,
      seed: event.slug,
    },
    CACHE_UNDATED,
  );
}
