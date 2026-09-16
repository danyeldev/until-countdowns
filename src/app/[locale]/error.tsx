"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/Icon";
import { Link } from "@/i18n/navigation";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  return (
    <section role="alert" className="mx-auto max-w-xl py-16 text-center sm:py-24">
      <Icon name="clock" size={36} className="mx-auto text-amber" />
      <p className="eyebrow mt-6">{t("eyebrow")}</p>
      <h1 className="mt-4 page-heading">{t("heading")}</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">{t("body")}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="button-primary">
          {t("tryAgain")}
        </button>
        <Link href="/create" className="button-secondary">
          {t("create")}
        </Link>
      </div>
    </section>
  );
}
