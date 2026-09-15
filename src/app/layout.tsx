import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { CollectionProvider } from "@/components/CollectionProvider";
import { Footer, FooterFallback } from "@/components/Footer";
import { Header } from "@/components/Header";
import {
  absoluteUrl,
  HOME_TITLE,
  SITE_DESCRIPTION,
  SITE_NAME,
  siteUrl,
} from "@/lib/seo";
import "./globals.css";

const sans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: SITE_NAME,
  category: "lifestyle",
  referrer: "strict-origin-when-cross-origin",
  metadataBase: new URL(siteUrl()),
  title: {
    default: HOME_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: absoluteUrl("/og/default"),
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <CollectionProvider>
          <Suspense fallback={<div className="h-[72px] border-b border-line" />}>
            <Header />
          </Suspense>
          <main
            id="main-content"
            tabIndex={-1}
            className="app-main focus:outline-none"
          >
            <div className="app-canvas">{children}</div>
          </main>
        </CollectionProvider>
        <Suspense fallback={<FooterFallback />}>
          <Footer />
        </Suspense>
      </body>
    </html>
  );
}
