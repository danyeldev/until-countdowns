import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Footer, FooterFallback } from "@/components/Footer";
import { Header } from "@/components/Header";
import { LOCALES, localeMeta, toLocale } from "@/lib/i18n/config";
import { i18nFor } from "@/lib/i18n/server";
import { absoluteUrl, SITE_NAME, siteUrl } from "@/lib/seo";
import "../globals.css";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

/**
 * The root layout sits under `[locale]`, which is what makes `locale` a **root parameter**: any
 * Server Component below can read it with `next/root-params` instead of being handed it. Every
 * locale is listed so `/es`, `/ja`, … prerender at build; the pages below choose for themselves how
 * much of their own parameter space to prerender per locale (see `generateStaticParams` there).
 */
export function generateStaticParams(): { locale: string }[] {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const L = i18nFor(toLocale((await params).locale));
  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: L.m.seo.homeTitle,
      template: L.m.seo.titleTemplate,
    },
    description: L.m.seo.siteDescription,
    openGraph: {
      siteName: SITE_NAME,
      type: "website",
      locale: localeMeta(L.locale).ogLocale,
      images: [{ url: absoluteUrl("/og/default"), width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
    verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  // An unknown first segment (`/foobar`) reaches here before the page can 404 it, so the shell is
  // rendered in English rather than with `lang="foobar"`; the page below calls `notFound()`.
  const locale = toLocale((await params).locale);
  const L = i18nFor(locale);
  const meta = localeMeta(locale);

  return (
    <html
      lang={meta.lang}
      dir={meta.dir}
      className={`${sans.variable} ${serif.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Suspense fallback={<div className="h-14 border-b border-line" />}>
          <Header locale={locale} nav={L.m.common.nav} search={L.m.common.search} siteName={L.m.common.siteName} />
        </Suspense>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
        <Suspense fallback={<FooterFallback wordmark={L.m.common.wordmarkLine} aboutLabel={L.m.common.footer.aboutTheData} href={L.href("/about")} />}>
          <Footer />
        </Suspense>
      </body>
    </html>
  );
}
