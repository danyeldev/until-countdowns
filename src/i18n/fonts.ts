import {
  Geist,
  Geist_Mono,
  Noto_Sans,
  Noto_Sans_Arabic,
  Noto_Sans_Devanagari,
  Noto_Sans_Hebrew,
  Noto_Sans_JP,
  Noto_Sans_KR,
  Noto_Sans_SC,
  Noto_Sans_TC,
  Noto_Sans_Thai,
} from "next/font/google";
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

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-ar",
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  preload: false,
});

const notoHebrew = Noto_Sans_Hebrew({
  variable: "--font-noto-he",
  subsets: ["hebrew"],
  weight: ["400", "500", "600"],
  preload: false,
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-hi",
  subsets: ["devanagari"],
  weight: ["400", "500", "600"],
  preload: false,
});

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-th",
  subsets: ["thai"],
  weight: ["400", "500", "600"],
  preload: false,
});

const notoJp = Noto_Sans_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  preload: false,
});

const notoKr = Noto_Sans_KR({
  variable: "--font-noto-kr",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  preload: false,
});

const notoSc = Noto_Sans_SC({
  variable: "--font-noto-sc",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  preload: false,
});

const notoTc = Noto_Sans_TC({
  variable: "--font-noto-tc",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  preload: false,
});

export function localeFontClass(locale: string): string {
  const extras = {
    latin: "",
    cyrillic: notoSans.variable,
    greek: notoSans.variable,
    vietnamese: notoSans.variable,
    arabic: notoArabic.variable,
    hebrew: notoHebrew.variable,
    devanagari: notoDevanagari.variable,
    thai: notoThai.variable,
    jp: notoJp.variable,
    kr: notoKr.variable,
    sc: notoSc.variable,
    tc: notoTc.variable,
  } as const;
  return [sans.variable, mono.variable, extras[localeFont(locale)]].filter(Boolean).join(" ");
}
