import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAuthServerClient, getAuthClaims } from "@/lib/auth/server";
import { isAuthConfigured } from "@/lib/auth/env";
import { cached } from "@/lib/cache";
import { anonClient } from "@/lib/db/client";
import {
  HYPE_VISITOR_COOKIE,
  isHypeKind,
  parseHypeEventKey,
  parseHypeSnapshot,
  parseHypeVisitorId,
} from "@/lib/hype";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex",
};

const publicHeaders = {
  "Cache-Control": "public, max-age=0, s-maxage=60",
  "X-Robots-Tag": "noindex",
};

function hypeTag(eventKey: string): string {
  return `hype:${eventKey}`;
}

function readPoints(eventKey: string): Promise<number> {
  // Only the public aggregate is cached. Never read auth cookies or action history here.
  return cached(
    async () => {
      const { data, error } = await anonClient()
        .from("event_hype")
        .select("points")
        .eq("event_key", eventKey)
        .maybeSingle();
      if (error) throw error;
      return data?.points ?? 0;
    },
    ["hype", "points", eventKey],
    { tags: [hypeTag(eventKey)], revalidate: 60 },
  )();
}

const BOT_UA =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|facebot|slackbot|twitterbot|linkedinbot|discordbot|whatsapp|telegram|embedly|quora|pinterest|reddit|ia_archiver/i;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers });
}

function visitorId(request: NextRequest, userId: string | null): { id: string; setCookie: string | null } {
  if (userId) return { id: `u:${userId}`, setCookie: null };
  const existing = parseHypeVisitorId(request.cookies.get(HYPE_VISITOR_COOKIE)?.value);
  if (existing) return { id: existing, setCookie: null };
  const minted = `v:${crypto.randomUUID()}`;
  return { id: minted, setCookie: minted };
}

function attachVisitor(response: NextResponse, cookie: string | null): NextResponse {
  if (cookie) {
    response.cookies.set(HYPE_VISITOR_COOKIE, cookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
    });
  }
  return response;
}

export async function GET(request: NextRequest) {
  const eventKey = parseHypeEventKey(request.nextUrl.searchParams.get("eventKey"));
  if (!eventKey) return json({ error: "Unknown countdown." }, 400);
  if (!isAuthConfigured()) return json({ points: 0, added: 0, kind: null });
  try {
    return NextResponse.json(
      { points: await readPoints(eventKey), added: 0, kind: null },
      { headers: publicHeaders },
    );
  } catch {
    return json({ error: "Could not load that." }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthConfigured()) return json({ points: 0, added: 0, kind: null });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send a JSON body." }, 400);
  }
  const record = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const eventKey = parseHypeEventKey(record.eventKey);
  const kind = isHypeKind(record.kind) ? record.kind : null;
  if (!eventKey || !kind) return json({ error: "Unknown countdown or action." }, 400);

  const ua = request.headers.get("user-agent") || "";
  if (kind === "visit" && BOT_UA.test(ua)) {
    try {
      return json({ points: await readPoints(eventKey), added: 0, kind });
    } catch {
      return json({ error: "Could not load that." }, 503);
    }
  }

  const claims = await getAuthClaims();
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  const minted = visitorId(request, userId);
  const visitor = minted.id;
  const supabase = await createAuthServerClient();
  const { data, error } = await supabase.rpc("record_event_hype", {
    p_event_key: eventKey,
    p_kind: kind,
    p_visitor_id: visitor,
  });
  if (error) return json({ error: "Could not record that." }, 503);
  const snapshot = parseHypeSnapshot(data) ?? { points: 0, added: 0, kind };
  // Do not invalidate catalog-wide caches on every visit. The writer gets the fresh
  // RPC total immediately; other readers can use the short-lived public response.
  if (snapshot.added > 0) revalidateTag(hypeTag(eventKey), { expire: 0 });
  return attachVisitor(json(snapshot), minted.setCookie);
}
