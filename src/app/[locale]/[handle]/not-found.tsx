import { getTranslations } from "next-intl/server";
import { SignInButton } from "@/components/SignInButton";
import { Icon } from "@/components/Icon";
import { Link } from "@/i18n/navigation";

export default async function ProfileNotFound() {
  const t = await getTranslations("errors");
  return (
    <section className="mx-auto max-w-xl py-16 text-center sm:py-24">
      <p className="eyebrow">{t("profileMissingEyebrow")}</p>
      <h1 className="page-heading mt-4">{t("profileMissing")}</h1>
      <p className="mt-5 text-sm leading-relaxed text-muted">{t("profileMissingBody")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="button-primary">
          {t("explore")} <Icon name="arrow" size={16} />
        </Link>
        <SignInButton className="button-secondary" next="/" initialMode="signup">
          {t("createAccount")}
        </SignInButton>
      </div>
    </section>
  );
}
