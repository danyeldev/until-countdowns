import Link from "next/link";

export function Footer() {
  return (
    <footer className="app-footer">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 border-t border-line/60 pt-5 text-xs text-muted">
        <p>
          <span className="font-medium text-paper-dim">until</span>
          <span className="mx-2 text-line">/</span>A little closer to what’s
          next.
        </p>
        <nav aria-label="About Until" className="flex flex-wrap gap-5">
          <Link href="/category" className="hover:text-paper">
            Categories
          </Link>
          <Link href="/country" className="hover:text-paper">
            Countries
          </Link>
          <Link href="/about" className="hover:text-paper">
            About & sources
          </Link>
          <Link href="/attributions" className="hover:text-paper">
            Attributions
          </Link>
          <Link href="/saved" className="hover:text-paper">
            Your space
          </Link>
          <Link href="/notifications" className="hover:text-paper">
            Notifications
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export const FooterFallback = Footer;
