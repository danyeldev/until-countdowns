import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const CRON_HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

/** Keep a cleanup window between a worker's budget and the function's hard timeout. */
export function cronBudget(param: string | null, env: string | undefined, maximum = 240_000): number {
  const supplied = Number(param);
  const configured = Number(env);
  const desired = Number.isFinite(supplied) && supplied > 0 ? supplied : Number.isFinite(configured) && configured > 0 ? configured : maximum;
  return Math.max(1, Math.min(Math.floor(desired), maximum));
}

export function cronTrigger(req: NextRequest): "cron" | "manual" {
  return req.headers.has("x-vercel-cron-schedule") || req.headers.get("user-agent")?.startsWith("vercel-cron") ? "cron" : "manual";
}

/**
 * Bearer check shared by the cron handlers and `/api/revalidate`.
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; ops call the same routes by hand.
 * Returns a Response to send back when the request is not authorised, else null.
 */
export function assertCron(req: NextRequest): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 503, headers: CRON_HEADERS });
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  const ok = a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
  if (!ok) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers: { ...CRON_HEADERS, "WWW-Authenticate": "Bearer" } });
  }
  return null;
}
