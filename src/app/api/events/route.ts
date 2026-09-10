import { NextRequest, NextResponse } from "next/server";
import { queryEvents } from "@/lib/catalog";
import { CATEGORIES, type Category } from "@/lib/types";

const SORTS = ["soonest", "popular", "latest"] as const;
type Sort = (typeof SORTS)[number];

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const q = url.searchParams.get("q")?.trim().slice(0, 80) || undefined;
  const categoryRaw = url.searchParams.get("category") ?? undefined;
  const category = CATEGORIES.includes(categoryRaw as Category) ? (categoryRaw as Category) : undefined;
  const tag = url.searchParams.get("tag")?.trim() || undefined;
  const region = url.searchParams.get("region")?.trim() || undefined;
  const sortRaw = url.searchParams.get("sort") ?? "soonest";
  const sort: Sort = SORTS.includes(sortRaw as Sort) ? (sortRaw as Sort) : "soonest";
  const featured = url.searchParams.get("featured") === "1" || url.searchParams.get("featured") === "true";
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(url.searchParams.get("pageSize") || 24);

  const result = await queryEvents({ q, category, tag, region, sort, featured, page, pageSize });

  // `summary` is Wikipedia prose under CC BY-SA 4.0. The event page carries its attribution
  // ("Summary from Wikipedia (CC BY-SA 4.0)" linking the article); a JSON payload a third party
  // copies has nowhere to carry it, so the field is left out of the API and `description` — our
  // own text — is what consumers get.
  const items = result.items.map((event) => {
    const rest = { ...event };
    delete rest.summary;
    return rest;
  });

  return NextResponse.json({ ...result, items }, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
