import { localePage } from "@/lib/i18n/server";

/**
 * A layout that renders nothing, for the one thing a layout can do that a page cannot: refuse an
 * unknown locale *before* the response starts.
 *
 * `/foobar` reaches the home route as a locale — the English sections are rewritten to `/en/…`
 * ahead of the filesystem, so a bare unknown word can only be a locale segment. The page refuses it
 * too, but this segment has a `loading.tsx`, and by the time the page component runs its shell has
 * been streamed with a 200 that cannot be taken back; the reader would get a 404 page under a 200,
 * which is the soft 404 Google penalises. A `loading.tsx` wraps the page, not the layout above it,
 * so the check lands on the right side of that boundary.
 */
export default async function HomeLayout({ children }: LayoutProps<"/[locale]">) {
  await localePage();
  return children;
}
