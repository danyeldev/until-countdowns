import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * The 404 for a path under a real locale that nothing else claimed (`/es/nope/here`).
 *
 * Lowest-priority match in the tree — static segments beat dynamic ones, dynamic beat catch-alls —
 * so it only ever sees what every other route declined. It answers 404; the markup arrives in the
 * flight payload rather than the HTML, which is how Next serves a page-thrown `notFound()` when the
 * root layout sits under a dynamic segment (see `src/lib/i18n/server.ts`).
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function CatchAll(): never {
  notFound();
}
