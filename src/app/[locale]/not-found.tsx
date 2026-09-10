import Link from "next/link";
import { i18n } from "@/lib/i18n/server";

/**
 * The lenient `i18n()` rather than `localePage()`: this *is* the 404, and a page that 404s its own
 * unknown locale would recurse. An unrecognised first segment renders the English shell instead.
 */
export default async function NotFound() {
  const L = await i18n();
  const m = L.m.pages.notFound;

  return (
    <div className="py-20">
      <p className="text-[11px] uppercase tracking-[0.24em] text-amber">404</p>
      <h1 className="mt-3 font-serif text-4xl text-paper">{m.heading}</h1>
      <p className="mt-4 text-paper-dim">{m.body}</p>
      <Link href={L.href("/")} className="mt-6 inline-block text-amber underline">
        {m.backHome}
      </Link>
    </div>
  );
}
