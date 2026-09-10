import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { catalogMeta } from "@/lib/catalog";
import { i18n } from "@/lib/i18n/server";
import { nextMonth, pad2, todayUtc, yearMonthOf } from "@/lib/seo";
import type { Category } from "@/lib/types";

const TOP_CATEGORIES = 8;

function FooterShell({ children }: { children: React.ReactNode }) {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted sm:px-6">{children}</div>
    </footer>
  );
}

export async function Footer() {
  const L = await i18n();
  const meta = await catalogMeta();
  const labels = L.m.categories.labels;
  const top = Object.entries(meta.stats.byCat)
    .filter(([name]) => name in labels)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_CATEGORIES)
    .map(([name]) => name as Category);
  const thisMonth = yearMonthOf(todayUtc());
  const next = nextMonth(thisMonth.year, thisMonth.month);

  return (
    <FooterShell>
      <div className="grid gap-8 sm:grid-cols-3">
        <div>
          <p className="font-serif text-paper-dim">{L.m.common.wordmarkLine}</p>
          <p className="tabular mt-2">
            {L.tn(L.m.common.footer.datesCount, meta.count)} ·{" "}
            <Link href={L.href("/about")} className="hover:text-paper">
              {L.m.common.footer.aboutTheData}
            </Link>{" "}
            ·{" "}
            <Link href={L.href("/attributions")} className="hover:text-paper">
              {L.m.common.footer.attributions}
            </Link>
          </p>
          <div className="mt-6">
            <LanguageSwitcher locale={L.locale} label={L.m.common.languageSwitcher.label} />
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em]">{L.m.common.footer.categories}</p>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {top.map((c) => (
              <li key={c}>
                <Link href={L.href(`/category/${c}`)} className="hover:text-paper">
                  {labels[c]}
                </Link>
              </li>
            ))}
            <li>
              <Link href={L.href("/category")} className="text-paper-dim hover:text-paper">
                {L.m.common.footer.all}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em]">{L.m.common.footer.browse}</p>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            <li>
              <Link href={L.href("/days-until")} className="hover:text-paper">
                {L.m.common.nav.daysUntil}
              </Link>
            </li>
            <li>
              <Link href={L.href("/country")} className="hover:text-paper">
                {L.m.common.nav.countries}
              </Link>
            </li>
            <li>
              <Link href={L.href(`/calendar/${thisMonth.year}/${pad2(thisMonth.month)}`)} className="hover:text-paper">
                {L.fmt.monthYear(thisMonth.year, thisMonth.month)}
              </Link>
            </li>
            <li>
              <Link href={L.href(`/calendar/${next.year}/${pad2(next.month)}`)} className="hover:text-paper">
                {L.fmt.monthYear(next.year, next.month)}
              </Link>
            </li>
            <li>
              <Link href={L.href("/create")} className="hover:text-paper">
                {L.m.common.footer.makeYourOwn}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </FooterShell>
  );
}

/**
 * Rendered while the footer's catalog read is in flight, so it takes its two strings as props: it
 * is inside the layout's `<Suspense>` fallback, which is built before the boundary resolves.
 */
export function FooterFallback({ wordmark, aboutLabel, href }: { wordmark: string; aboutLabel: string; href: string }) {
  return (
    <FooterShell>
      <p className="font-serif text-paper-dim">{wordmark}</p>
      <p className="mt-2">
        <Link href={href} className="hover:text-paper">
          {aboutLabel}
        </Link>
      </p>
    </FooterShell>
  );
}
