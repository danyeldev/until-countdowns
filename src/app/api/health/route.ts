import { anonClient, supabaseEnv } from "@/lib/db/client";

/**
 * Public health summary: catalog size, per-source row counts and how recently the nightly
 * finalize ran. Cached at the CDN for 60 s. It reads only anon-visible data (catalog_stats),
 * never the ingest tables — those stay service-role only, and the secret-protected detail
 * (per-source run history, leases, backoff) lives at /api/cron/status.
 */
export const revalidate = 0;

export async function GET() {
  const started = Date.now();

  if (!supabaseEnv()) {
    return Response.json(
      { ok: false, error: "database is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: stats, error } = await anonClient()
    .from("catalog_stats")
    .select("count, featured, series_count, generated_at, by_cat, by_src")
    .maybeSingle();

  if (error) {
    return Response.json(
      { ok: false, error: "database unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const bySrc = (stats?.by_src ?? {}) as Record<string, number>;
  const byCat = (stats?.by_cat ?? {}) as Record<string, number>;
  const count = stats?.count ?? 0;

  // The catalog is only "ok" when it actually holds events and the nightly finalize ran
  // recently enough that day counts are trustworthy.
  const generatedAt = stats?.generated_at ? Date.parse(stats.generated_at) : NaN;
  const finalizeAgeHours = Number.isNaN(generatedAt) ? null : (Date.now() - generatedAt) / 3_600_000;
  const ok = count > 0 && (finalizeAgeHours === null || finalizeAgeHours < 48);

  return Response.json(
    {
      ok,
      events: count,
      featured: stats?.featured ?? 0,
      series: stats?.series_count ?? 0,
      categories: Object.keys(byCat).length,
      sources: Object.keys(bySrc).length,
      by_source: bySrc,
      finalize_generated_at: stats?.generated_at ?? null,
      finalize_age_hours: finalizeAgeHours === null ? null : Math.round(finalizeAgeHours * 10) / 10,
      took_ms: Date.now() - started,
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    },
  );
}
