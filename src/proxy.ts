import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Skip static assets and generated images. Catalog HTML still matches so a
     * signed-in session can refresh; signed-out requests are a no-op in updateSession.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
