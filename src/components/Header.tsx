"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { parseHandle } from "@/lib/auth/profile";
import { AuthMenu } from "./AuthMenu";
import { NotificationBell } from "./NotificationBell";
import { Icon, type IconName } from "./Icon";
import { QuickSearch } from "./QuickSearch";

const MAIN: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Explore", icon: "compass" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/saved", label: "My space", icon: "bookmark" },
  { href: "/collections", label: "Collections", icon: "list" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
];
const EXPLORE: { href: string; label: string; icon: IconName }[] = [
  { href: "/category", label: "Categories", icon: "grid" },
  { href: "/days-until", label: "Recurring events", icon: "clock" },
  { href: "/country", label: "Around the world", icon: "globe" },
];

function workspaceLabel(pathname: string, query: string | null): string {
  if (pathname === "/") return query ? "Search" : "Explore";
  if (pathname.startsWith("/login/complete")) return "Your profile";
  if (pathname.startsWith("/login")) return "Sign in";
  if (pathname.startsWith("/saved")) return "My space";
  if (pathname.startsWith("/collections")) return "Collections";
  if (pathname.startsWith("/notifications")) return "Notifications";
  if (pathname.startsWith("/create")) return "Create a countdown";
  if (pathname.startsWith("/calendar")) return "Calendar";
  if (pathname.startsWith("/days-until")) return "Recurring events";
  if (pathname.startsWith("/event")) return "Countdown";
  if (pathname.startsWith("/country")) return "Around the world";
  if (pathname.startsWith("/category")) return "Categories";
  const handle = parseHandle(pathname.slice(1).split("/")[0] ?? "");
  if (handle && pathname === `/${handle}`) return `@${handle}`;
  if (handle && pathname.startsWith(`/${handle}/`)) return "Collection";
  return "Explore";
}

function Logo() {
  return (
    <Link
      href="/"
      aria-label="Until home"
      className="inline-flex items-center gap-2.5"
    >
      <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-xl bg-amber text-[#171222]">
        <Icon name="clock" size={23} strokeWidth={2} />
        <span className="absolute -right-1 -top-1 size-4 rounded-full bg-white/30" />
      </span>
      <span className="text-[26px] font-semibold tracking-[-.07em]">
        until<span className="text-amber">.</span>
      </span>
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const pageLabel = workspaceLabel(pathname, params.get("q"));
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[216px] flex-col border-r border-white/[.055] bg-[#0c0e14] px-4 py-7 lg:flex">
        <div className="px-3">
          <Logo />
        </div>
        <nav aria-label="Main navigation" className="mt-10 space-y-1">
          {MAIN.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active(item.href) ? "page" : undefined}
              className="nav-item"
            >
              <Icon name={item.icon} size={19} />
              {item.label}
              {active(item.href) && (
                <span className="ml-auto size-1.5 rounded-full bg-amber" />
              )}
            </Link>
          ))}
        </nav>
        <p className="mb-3 mt-8 px-3 text-[10px] font-medium uppercase tracking-[.12em] text-muted/80">
          Discover more
        </p>
        <nav aria-label="Browse navigation" className="space-y-1">
          {EXPLORE.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active(item.href) ? "page" : undefined}
              className="nav-item"
            >
              <Icon name={item.icon} size={17} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <div className="rounded-2xl border border-white/[.07] bg-linear-to-br from-amber/[.08] to-transparent p-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber/10 text-amber">
              <Icon name="plus" size={17} />
            </span>
            <p className="mt-3 text-[13px] font-medium">Your next big thing.</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Give a personal moment its own countdown.
            </p>
            <Link
              href="/create"
              className="button-primary mt-4 w-full !min-h-11 !px-2 !py-2 !text-xs"
            >
              Create countdown <Icon name="arrow" size={14} />
            </Link>
          </div>
          <div className="mt-5 flex items-center gap-2 px-2 text-[10px] text-muted">
            <span className="size-1.5 rounded-full bg-moss" />
            Saved to your account
            <Link
              href="/about"
              aria-label="About Until"
              className="ml-auto rounded-md px-2 py-1 hover:text-paper"
            >
              ↗
            </Link>
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between gap-4 border-b border-white/[.06] bg-ink/85 px-5 backdrop-blur-xl sm:px-7 lg:ml-[216px] lg:px-9">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="hidden items-center gap-2 text-xs lg:flex">
          <span className="text-muted">Workspace</span>
          <span className="px-2 text-muted/40">/</span>
          <span className="text-paper-dim">{pageLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <QuickSearch />
          <Link
            href="/create"
            className="hidden min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-xs text-paper-dim transition hover:border-amber/40 hover:text-paper sm:flex"
          >
            <Icon name="plus" size={15} />
            New countdown
          </Link>
          <NotificationBell />
          <AuthMenu />
        </div>
      </header>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-4 bottom-3 z-40 mx-auto grid max-w-lg grid-cols-4 rounded-2xl border border-white/10 bg-[#171a24]/95 p-1.5 shadow-[0_8px_40px_#0009] backdrop-blur-xl lg:hidden"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        {[
          ...MAIN.filter((item) => item.href !== "/notifications" && item.href !== "/collections"),
          { href: "/create", label: "Create", icon: "plus" as const },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active(item.href) ? "page" : undefined}
            className={`flex min-h-[50px] flex-col items-center justify-center gap-1.5 rounded-xl text-[10px] ${active(item.href) ? "bg-amber/12 text-amber" : "text-muted hover:text-paper"}`}
          >
            <Icon name={item.icon} size={20} />
            {item.label === "My space" ? "Saved" : item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
