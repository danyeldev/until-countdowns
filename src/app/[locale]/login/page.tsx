import { localeOf, pathnameWithoutLocale } from "@/i18n/locales";
import { redirect } from "@/i18n/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getAuthClaims, getOwnProfile, profileIsComplete } from "@/lib/auth/server";
import { completeProfileHref, parseAuthMode, safeNextPath } from "@/lib/auth/paths";
import { localizedMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return localizedMetadata({
    title: "Sign in",
    description: "Sign in to Until with Google or your email and password.",
    canonical: "/login",
    ogPath: "/og/default",
    noindex: true,
    locale,
  });
}

function queryText(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.slice(0, 200) : "";
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[]; mode?: string | string[]; error?: string | string[]; message?: string | string[] }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const next = safeNextPath(query.next);
  if (await getAuthClaims()) {
    if (!profileIsComplete(await getOwnProfile())) {
      redirect({ href: pathnameWithoutLocale(completeProfileHref(next)), locale: localeOf(locale) });
    }
    redirect({ href: pathnameWithoutLocale(next), locale: localeOf(locale) });
  }
  return (
    <AuthForm
      mode={parseAuthMode(query.mode)}
      next={next}
      initialError={queryText(query.error)}
      initialMessage={queryText(query.message)}
    />
  );
}
