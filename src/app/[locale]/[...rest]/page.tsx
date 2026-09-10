import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * The 404 route, and the reason there is no `global-not-found.tsx`.
 *
 * With the root layout under `[locale]`, an unmatched URL (`/foo/bar`, `/es/nope/here`) has no
 * route to fall into, and Next's built-in 404 renders outside the app shell. This catch-all is the
 * lowest-priority match in the tree — static segments beat dynamic ones, dynamic beat catch-alls —
 * so it only ever sees paths nothing else claimed, and turns them into a `notFound()` that renders
 * `[locale]/not-found.tsx` with the header, the footer and a 404 status.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function CatchAll(): never {
  notFound();
}
