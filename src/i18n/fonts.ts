import { Geist, Geist_Mono, Noto_Sans } from "next/font/google";
import { localeFont } from "./locales";

const sans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

const notoSans = Noto_Sans({
  variable: "--font-noto",
  subsets: ["cyrillic", "cyrillic-ext", "greek", "vietnamese"],
  weight: ["400", "500", "600"],
  preload: false,
});

const SYSTEM_FONT_CLASS: Record<string, string> = {
  arabic: "font-ar",
  hebrew: "font-he",
  devanagari: "font-hi",
  thai: "font-th",
  jp: "font-jp",
  kr: "font-kr",
  sc: "font-sc",
  tc: "font-tc",
};

export function localeFontClass(locale: string): string {
  const family = localeFont(locale);
  const extras =
    family === "cyrillic" || family === "greek" || family === "vietnamese"
      ? notoSans.variable
      : (SYSTEM_FONT_CLASS[family] ?? "");
  return [sans.variable, mono.variable, extras].filter(Boolean).join(" ");
}
