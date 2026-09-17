"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Icon } from "@/components/Icon";
import { Link } from "@/i18n/navigation";

/** A failed catalog read remains a retryable 500 rather than a cached missing date. */
export default function EventError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="mx-auto max-w-2xl px-6 py-16 text-center sm:py-24">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber/15 text-amber">
        <Icon name="clock" size={25} />
      </div>
      <p className="mt-6 text-sm font-medium text-amber">{t("eventErrorEyebrow")}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
        {t("eventErrorHeading")}
      </h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">{t("eventErrorBody")}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="button-primary">
          {t("tryAgain")}
        </button>
        <Link href="/" className="button-secondary">
          {t("explore")}
        </Link>
      </div>
    </section>
  );
}
