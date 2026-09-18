"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { parseHandle } from "@/lib/auth/profile";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { HeaderAuth, useSignedInHint } from "./HeaderAuth";
import { Icon, type IconName } from "./Icon";
import { QuickSearch } from "./QuickSearch";
import { AuthGateLink } from "./SignInButton";
import { Link, usePathname } from "@/i18n/navigation";

export function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const params = useSearchParams();
  const signedIn = useSignedInHint();

  const MAIN: { href: string; label: string; icon: IconName }[] = [
    { href: "/", label: t("explore"), icon: "compass" },
    { href: "/calendar", label: t("calendar"), icon: "calendar" },
    { href: "/saved", label: t("mySpace"), icon: "bookmark" },
    { href: "/collections", label: t("collections"), icon: "list" },
  ];
  const EXPLORE: { href: string; label: string; icon: IconName }[] = [
    { href: "/category", label: t("categories"), icon: "grid" },
    { href: "/days-until", label: t("recurring"), icon: "clock" },
    { href: "/country", label: t("aroundTheWorld"), icon: "globe" },
  ];

  function workspaceLabel(path: string, query: string | null): string {
    if (path === "/" || path.startsWith("/search")) return query ? t("workspace.search") : t("workspace.explore");
    if (path.startsWith("/login/complete")) return t("workspace.profile");
    if (path.startsWith("/login")) return t("workspace.signIn");
    if (path.startsWith("/saved")) return t("workspace.mySpace");
    if (path.startsWith("/collections")) return t("workspace.collections");
    if (path.startsWith("/notifications")) return t("workspace.notifications");
    if (path.startsWith("/create")) return t("workspace.create");
    if (path.startsWith("/calendar")) return t("workspace.calendar");
    if (path.startsWith("/days-until")) return t("workspace.recurring");
    if (path.startsWith("/event")) return t("workspace.countdown");
    if (path.startsWith("/country")) return t("workspace.world");
    if (path.startsWith("/category")) return t("workspace.categories");
    const handle = parseHandle(path.slice(1).split("/")[0] ?? "");
    if (handle && path === `/${handle}`) return `@${handle}`;
    if (handle && path.startsWith(`/${handle}/`)) return t("workspace.collection");
    return t("workspace.explore");
  }

  const mainItems = MAIN.filter((item) => item.href !== "/saved" || signedIn);
  const mobileItems = [
    ...mainItems,
    { href: "/create", label: t("create"), icon: "plus" as const },
  ];
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const pageLabel = workspaceLabel(pathname, params.get("q"));

  return (
    <>
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-[216px] flex-col border-e border-white/[.055] bg-[#0c0e14] px-4 py-7 lg:flex">
        <div className="px-3">
          <Link href="/" aria-label={t("homeAria")} className="inline-flex items-center gap-2.5">
            <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-xl bg-amber text-[#171222]">
              <Icon name="clock" size={23} strokeWidth={2} />
              <span className="absolute -end-1 -top-1 size-4 rounded-full bg-white/30" />
            </span>
            <span className="text-[26px] font-semibold tracking-[-.07em]">
              until<span className="text-amber">.</span>
            </span>
          </Link>
        </div>
        <nav aria-label={t("main")} className="mt-10 space-y-1">
          {mainItems.map((item) => (
            <AuthGateLink
              key={item.href}
              href={item.href}
              ariaCurrent={active(item.href) ? "page" : undefined}
              className="nav-item"
            >
              <Icon name={item.icon} size={19} />
              {item.label}
              {active(item.href) && <span className="ms-auto size-1.5 rounded-full bg-amber" />}
            </AuthGateLink>
          ))}
        </nav>
        <p className="mb-3 mt-8 px-3 text-[10px] font-medium uppercase tracking-[.12em] text-muted/80">
          {t("discoverMore")}
        </p>
        <nav aria-label={t("browse")} className="space-y-1">
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
            <p className="mt-3 text-[13px] font-medium">{t("yourNextBigThing")}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">{t("personalMoment")}</p>
            <AuthGateLink href="/create" className="button-primary mt-4 w-full !min-h-11 !px-2 !py-2 !text-xs">
              {t("createCountdown")} <Icon name="arrow" size={14} />
            </AuthGateLink>
          </div>
          <div className="mt-5 flex items-center gap-2 px-2 text-[10px] text-muted">
            <span className="size-1.5 rounded-full bg-moss" />
            {t("savedToAccount")}
            <Link href="/about" aria-label={t("aboutUntil")} className="ms-auto rounded-md px-2 py-1 hover:text-paper">
              ↗
            </Link>
          </div>
          <div className="mt-4 px-2">
            <LanguageSwitcher compact />
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between gap-4 border-b border-white/[.06] bg-ink/85 px-5 backdrop-blur-xl sm:px-7 lg:ms-[216px] lg:px-9">
        <div className="lg:hidden">
          <Link href="/" aria-label={t("homeAria")} className="inline-flex items-center gap-2.5">
            <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-xl bg-amber text-[#171222]">
              <Icon name="clock" size={23} strokeWidth={2} />
            </span>
            <span className="text-[26px] font-semibold tracking-[-.07em]">
              until<span className="text-amber">.</span>
            </span>
          </Link>
        </div>
        <div className="hidden text-xs text-paper-dim lg:block">{pageLabel}</div>
        <div className="flex items-center gap-3">
          <QuickSearch />
          <AuthGateLink
            href="/create"
            className="hidden min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-xs text-paper-dim transition hover:border-amber/40 hover:text-paper sm:flex"
          >
            <Icon name="plus" size={15} />
            {t("newCountdown")}
          </AuthGateLink>
          <HeaderAuth />
        </div>
      </header>
      <nav
        aria-label={t("mobile")}
        className={`fixed inset-x-4 bottom-3 z-40 mx-auto grid max-w-lg rounded-2xl border border-white/10 bg-[#171a24]/95 p-1.5 shadow-[0_8px_40px_#0009] backdrop-blur-xl lg:hidden ${mobileItems.length >= 5 ? "grid-cols-5" : mobileItems.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        {mobileItems.map((item) => (
          <AuthGateLink
            key={item.href}
            href={item.href}
            ariaCurrent={active(item.href) ? "page" : undefined}
            className={`flex min-h-[50px] flex-col items-center justify-center gap-1.5 rounded-xl text-[10px] ${active(item.href) ? "bg-amber/12 text-amber" : "text-muted hover:text-paper"}`}
          >
            <Icon name={item.icon} size={20} />
            {item.label === t("mySpace") ? t("saved") : item.label}
          </AuthGateLink>
        ))}
      </nav>
    </>
  );
}
