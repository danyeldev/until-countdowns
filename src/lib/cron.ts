import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Bearer check shared by the cron handlers and `/api/revalidate`.
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; ops call the same routes by hand.
 * Returns a Response to send back when the request is not authorised, else null.
 */
export function assertCron(req: NextRequest): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  const ok = a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
  if (!ok) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }
  return null;
}
