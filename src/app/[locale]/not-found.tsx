import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/Icon";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <section className="mx-auto max-w-xl py-16 text-center sm:py-24">
      <p className="eyebrow">{t("notFoundEyebrow")}</p>
      <h1 className="mt-4 page-heading">{t("notFoundHeading")}</h1>
      <p className="mt-5 text-sm leading-relaxed text-muted">{t("notFoundBody")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="button-primary">
          {t("explore")} <Icon name="arrow" size={16} />
        </Link>
        <Link href="/create" className="button-secondary">
          {t("makeYourOwn")}
        </Link>
      </div>
    </section>
  );
}
