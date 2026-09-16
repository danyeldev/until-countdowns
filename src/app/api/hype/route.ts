import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient, getAuthClaims } from "@/lib/auth/server";
import { isAuthConfigured } from "@/lib/auth/env";
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
  const supabase = await createAuthServerClient();
  const { data } = await supabase.from("event_hype").select("points").eq("event_key", eventKey).maybeSingle();
  return json({ points: data?.points ?? 0, added: 0, kind: null });
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
    const supabase = await createAuthServerClient();
    const { data } = await supabase.from("event_hype").select("points").eq("event_key", eventKey).maybeSingle();
    return json({ points: data?.points ?? 0, added: 0, kind });
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
  return attachVisitor(json(snapshot), minted.setCookie);
}
