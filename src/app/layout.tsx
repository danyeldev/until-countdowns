import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { HOME_TITLE, SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/seo";
import "./globals.css";

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
