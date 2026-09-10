import type { NextRequest } from "next/server";
import { CATEGORY_LABELS } from "@/lib/labels";
import { CACHE_UNDATED, daysBetween, renderOgCard } from "@/lib/og";
import { longDate } from "@/lib/i18n/format";
import { todayUtc } from "@/lib/seo";
import { decodeSharePayload } from "@/lib/user-events";

export const runtime = "nodejs";

const TITLE_MAX = 90;

/** OG card for a personal countdown shared as `/event/share-<payload>`. Gradient only, never an image. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ payload: string }> }) {
  const { payload } = await ctx.params;
  const shared = decodeSharePayload(payload.replace(/\.png$/, "").slice(0, 2000));
  if (!shared) {
    return renderOgCard(
      { eyebrow: "Shared countdown", title: "A countdown someone made", subtitle: "Open it on Until", seed: "share" },
      CACHE_UNDATED,
    );
  }
  const title = shared.title.replace(/\s+/g, " ").trim();
  return renderOgCard(
    {
      eyebrow: `Shared · ${CATEGORY_LABELS[shared.category]}`,
      title: title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1).trimEnd()}…` : title,
      subtitle: longDate("en", shared.date),
      days: daysBetween(todayUtc(), shared.date, true),
      imageUrl: null,
      seed: `share:${shared.title}:${shared.date}`,
    },
    CACHE_UNDATED,
  );
}
