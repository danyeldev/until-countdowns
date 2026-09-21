import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Link } from "@/i18n/navigation";

const { nextLinkProps } = vi.hoisted(() => ({ nextLinkProps: vi.fn() }));

// next-intl delegates to Next's bundler-only modules. Check our policy at that boundary.
vi.mock("next-intl/navigation", async () => {
  const { createElement } = await import("react");
  return {
    createNavigation: () => ({
      Link: (props: { href: string; children: React.ReactNode; prefetch?: boolean | null }) => {
        nextLinkProps(props);
        return createElement("a", { href: props.href }, props.children);
      },
    }),
  };
});

describe("catalog navigation", () => {
  beforeEach(() => nextLinkProps.mockClear());

  it.each([
    "/event/new-year",
    "/category/holidays",
    "/es/event/new-year",
  ])("keeps a crawlable anchor without speculative fetches for %s", (href) => {
    const html = renderToStaticMarkup(createElement(Link, { href }, "New Year"));
    expect(html).toBe(`<a href="${href}">New Year</a>`);
    expect(nextLinkProps).toHaveBeenCalledWith(expect.objectContaining({ href, prefetch: false }));
  });

  it("preserves locale, navigation options and a deliberate prefetch opt-in", () => {
    const onClick = vi.fn();
    renderToStaticMarkup(createElement(Link, {
      href: "/event/new-year",
      locale: "es",
      prefetch: true,
      replace: true,
      onClick,
    }, "New Year"));
    expect(nextLinkProps).toHaveBeenCalledWith(expect.objectContaining({
      locale: "es", prefetch: true, replace: true, onClick,
    }));
  });
});
