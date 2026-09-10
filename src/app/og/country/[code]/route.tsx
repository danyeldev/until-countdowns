import type { NextRequest } from "next/server";
import { CACHE_UNDATED, renderOgCard } from "@/lib/og";
import { COUNTRY_NAMES } from "@/lib/regions";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const cc = code.replace(/\.png$/, "").toUpperCase();
  const name = cc !== "GLOBAL" ? COUNTRY_NAMES[cc] : undefined;
  if (!/^[A-Z]{2}$/.test(cc) || !name) return new Response("Unknown country", { status: 404 });
  return renderOgCard(
    {
      eyebrow: "Country",
      title: name,
      subtitle: "Upcoming holidays and events",
      seed: `country:${cc}`,
    },
    CACHE_UNDATED,
  );
}
