import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { EN } from "@/lib/i18n/messages/en";
import "./globals.css";

/**
 * The 404 for a URL that matches no route at all.
 *
 * It has to exist because the root layout lives under `[locale]`: Next's own docs name that as one
 * of the two cases `not-found.tsx` cannot cover, since there is no single layout to compose a 404
 * from. Without it an unmatched URL is served as a bare `__next_error__` document — the right
 * status, but nothing rendered until JavaScript arrives.
 *
 * It bypasses the layout entirely, so it brings its own `<html>`, its own fonts and its own
 * stylesheet. English, and `lang="en"`: a URL that matched nothing named no locale either.
 */
const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const serif = Fraunces({ variable: "--font-serif", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: EN.pages.notFound.heading,
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en" dir="ltr" className={`${sans.variable} ${serif.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
          <div className="py-20">
            <p className="text-[11px] uppercase tracking-[0.24em] text-amber">404</p>
            <h1 className="mt-3 font-serif text-4xl text-paper">{EN.pages.notFound.heading}</h1>
            <p className="mt-4 text-paper-dim">{EN.pages.notFound.body}</p>
            <Link href="/" className="mt-6 inline-block text-amber underline">
              {EN.pages.notFound.backHome}
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
