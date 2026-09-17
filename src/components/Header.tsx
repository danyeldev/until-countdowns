"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCollection } from "@/components/CollectionProvider";
import { parseHandle } from "@/lib/auth/profile";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { AuthMenu } from "./AuthMenu";
import { NotificationBell } from "./NotificationBell";
import { Icon, type IconName } from "./Icon";
import { QuickSearch } from "./QuickSearch";
import { AuthGateLink } from "./SignInButton";
import { Link, usePathname } from "@/i18n/navigation";

function Wordmark({ label }: { label: string }) {
  return (
    <Link href="/" aria-label={label} className="inline-flex items-center gap-2 rounded-lg">
      <span className="flex size-7 items-center justify-center rounded-full bg-amber text-[#171222]">
        <Icon name="clock" size={17} strokeWidth={2.2} />
      </span>
      <span className="text-[22px] font-semibold tracking-[-.05em]">until</span>
    </Link>
  );
}

export function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const params = useSearchParams();
  const { userId } = useCollection();
  const signedIn = Boolean(userId);

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
    if (path === "/") return query ? t("workspace.search") : t("workspace.explore");
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
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-[232px] flex-col px-5 py-7 lg:flex">
        <div className="px-3">
          <Wordmark label={t("homeAria")} />
        </div>
        <nav aria-label={t("main")} className="mt-9 space-y-0.5">
          {mainItems.map((item) => (
            <AuthGateLink
              key={item.href}
              href={item.href}
              ariaCurrent={active(item.href) ? "page" : undefined}
              className="nav-item"
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </AuthGateLink>
          ))}
        </nav>
        <p className="eyebrow mb-2 mt-8 px-3">{t("discoverMore")}</p>
        <nav aria-label={t("browse")} className="space-y-0.5">
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
        <div className="mt-auto space-y-5 px-1">
          <AuthGateLink href="/create" className="button-primary w-full">
            <Icon name="plus" size={16} />
            {t("createCountdown")}
          </AuthGateLink>
          <div className="flex items-center justify-between gap-2 px-2">
            <LanguageSwitcher compact />
            <Link href="/about" className="text-xs text-muted hover:text-paper">
              {t("aboutUntil")}
            </Link>
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 bg-ink/80 px-5 backdrop-blur-xl sm:px-8 lg:ms-[232px] lg:px-11">
        <div className="lg:hidden">
          <Wordmark label={t("homeAria")} />
        </div>
        <p className="hidden text-sm text-muted lg:block">{pageLabel}</p>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <QuickSearch />
          <span className="hidden sm:block">
            <AuthGateLink href="/create" className="button-ghost !px-3">
              <Icon name="plus" size={16} />
              {t("newCountdown")}
            </AuthGateLink>
          </span>
          <NotificationBell />
          <AuthMenu />
        </div>
      </header>
      <nav
        aria-label={t("mobile")}
        className={`fixed inset-x-4 bottom-3 z-40 mx-auto grid max-w-lg rounded-2xl bg-[#171a22]/95 p-1.5 shadow-[0_0_0_1px_#ffffff0a,0_12px_40px_#0009] backdrop-blur-xl lg:hidden ${mobileItems.length >= 5 ? "grid-cols-5" : mobileItems.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        {mobileItems.map((item) => (
          <AuthGateLink
            key={item.href}
            href={item.href}
            ariaCurrent={active(item.href) ? "page" : undefined}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] ${active(item.href) ? "text-paper" : "text-muted hover:text-paper"}`}
          >
            <Icon name={item.icon} size={20} className={active(item.href) ? "text-amber" : undefined} />
            {item.label === t("mySpace") ? t("saved") : item.label}
          </AuthGateLink>
        ))}
      </nav>
    </>
  );
}
