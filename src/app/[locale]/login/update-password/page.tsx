import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "@/components/UpdatePasswordForm";
import { loginHref } from "@/lib/auth/paths";
import { getAuthClaims } from "@/lib/auth/server";
import { localizedMetadata } from "@/lib/seo";
import { activateLocale } from "@/i18n/request-locale";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  activateLocale(locale);
  return localizedMetadata({
  title: "Update password",
  description: "Choose a new password for your Until account.",
  canonical: "/login/update-password",
  ogPath: "/og/default",
  noindex: true,
    locale,
  });
}

export default async function UpdatePasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  activateLocale(locale);
  if (!(await getAuthClaims())) {
    redirect(loginHref("/", { mode: "reset", error: "Open the reset link from your email to choose a new password." }));
  }
  return <UpdatePasswordForm />;
}
