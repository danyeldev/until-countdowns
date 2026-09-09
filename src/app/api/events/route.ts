import { NextRequest, NextResponse } from "next/server";
import { searchEvents } from "@/lib/catalog";
import { CATEGORIES, type Category } from "@/lib/types";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const q = url.searchParams.get("q") ?? undefined;
  const categoryRaw = url.searchParams.get("category") ?? undefined;
  const category = CATEGORIES.includes(categoryRaw as Category)
    ? (categoryRaw as Category)
    : undefined;
  const tag = url.searchParams.get("tag") ?? undefined;
  const region = url.searchParams.get("region") ?? undefined;
  const sortRaw = url.searchParams.get("sort") ?? "soonest";
  const sort = (["soonest", "popular", "latest"] as const).includes(sortRaw as "soonest")
    ? (sortRaw as "soonest" | "popular" | "latest")
    : "soonest";
  const page = Number(url.searchParams.get("page") || 1);
  const pageSize = Number(url.searchParams.get("pageSize") || 24);

  return NextResponse.json(
    searchEvents({ q, category, tag, region, sort, page, pageSize }),
  );
}
