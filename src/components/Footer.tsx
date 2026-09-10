import Link from "next/link";
import { catalogMeta } from "@/lib/catalog";
import { CATEGORY_LABELS } from "@/lib/labels";
import { monthLabel, nextMonth, pad2, todayUtc, yearMonthOf } from "@/lib/seo";
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
  const meta = await catalogMeta();
  const top = Object.entries(meta.stats.byCat)
    .filter(([name]) => name in CATEGORY_LABELS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_CATEGORIES)
    .map(([name]) => name as Category);
  const thisMonth = yearMonthOf(todayUtc());
  const next = nextMonth(thisMonth.year, thisMonth.month);

  return (
    <FooterShell>
      <div className="grid gap-8 sm:grid-cols-3">
        <div>
          <p className="font-serif text-paper-dim">Until — a catalog of things that haven’t happened yet.</p>
          <p className="tabular mt-2">
            {meta.count.toLocaleString("en-US")} dates ·{" "}
            <Link href="/about" className="hover:text-paper">
              about the data
            </Link>{" "}
            ·{" "}
            <Link href="/attributions" className="hover:text-paper">
              attributions
            </Link>
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em]">Categories</p>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {top.map((c) => (
              <li key={c}>
                <Link href={`/category/${c}`} className="hover:text-paper">
                  {CATEGORY_LABELS[c]}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/category" className="text-paper-dim hover:text-paper">
                all →
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em]">Browse</p>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            <li>
              <Link href="/days-until" className="hover:text-paper">
                Days until
              </Link>
            </li>
            <li>
              <Link href="/country" className="hover:text-paper">
                Countries
              </Link>
            </li>
            <li>
              <Link href={`/calendar/${thisMonth.year}/${pad2(thisMonth.month)}`} className="hover:text-paper">
                {monthLabel(thisMonth.year, thisMonth.month)}
              </Link>
            </li>
            <li>
              <Link href={`/calendar/${next.year}/${pad2(next.month)}`} className="hover:text-paper">
                {monthLabel(next.year, next.month)}
              </Link>
            </li>
            <li>
              <Link href="/create" className="hover:text-paper">
                Make your own
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </FooterShell>
  );
}

export function FooterFallback() {
  return (
    <FooterShell>
      <p className="font-serif text-paper-dim">Until — a catalog of things that haven’t happened yet.</p>
      <p className="mt-2">
        <Link href="/about" className="hover:text-paper">
          about the data
        </Link>
      </p>
    </FooterShell>
  );
}
