import { createElement, type ComponentProps } from "react";
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

const navigation = createNavigation(routing);

export const { redirect, usePathname, useRouter, getPathname } = navigation;

/**
 * Fetch pages when someone follows a link. Viewport prefetch otherwise fans a single catalog
 * visit (including a search engine's rendered visit) out into many unused page renders.
 * Keep next-intl's normal anchors, locale handling and client navigation so discovery is unchanged.
 * A measured exception can explicitly opt in with `prefetch`.
 */
export function Link({ prefetch = false, ...props }: ComponentProps<typeof navigation.Link>) {
  return createElement(navigation.Link, { ...props, prefetch });
}
