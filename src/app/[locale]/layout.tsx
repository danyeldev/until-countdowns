import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppProviders } from "@/components/AppProviders";
import { Footer, FooterFallback } from "@/components/Footer";
import { Header } from "@/components/Header";
import { localeFontClass } from "@/i18n/fonts";
import { localeBcp47, localeDir } from "@/i18n/locales";
import { allLocaleParams } from "@/i18n/params";
import { activateLocale } from "@/i18n/request-locale";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return allLocaleParams();
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  activateLocale(locale);

  const messages = await getMessages();
  const t = await getTranslations("common");

  return (
    <html
      lang={localeBcp47(locale)}
      dir={localeDir(locale)}
      className={`${localeFontClass(locale)} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://images.until.day" />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a className="skip-link" href="#main-content">
            {t("skipToContent")}
          </a>
          <AppProviders>
            <Suspense fallback={<div className="h-[72px] border-b border-line" />}>
              <Header />
            </Suspense>
            <main id="main-content" tabIndex={-1} className="app-main focus:outline-none">
              <div className="app-canvas">{children}</div>
            </main>
            <Suspense fallback={<FooterFallback />}>
              <Footer />
            </Suspense>
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
