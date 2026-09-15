import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getAuthClaims, getOwnProfile, profileIsComplete } from "@/lib/auth/server";
import { completeProfileHref, parseAuthMode, safeNextPath } from "@/lib/auth/paths";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Sign in",
  description: "Sign in to Until with Google or your email and password.",
  canonical: "/login",
  ogPath: "/og/default",
  noindex: true,
});

function queryText(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.slice(0, 200) : "";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; mode?: string | string[]; error?: string | string[]; message?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getAuthClaims()) {
    if (!profileIsComplete(await getOwnProfile())) redirect(completeProfileHref(next));
    redirect(next);
  }
  return (
    <AuthForm
      mode={parseAuthMode(params.mode)}
      next={next}
      initialError={queryText(params.error)}
      initialMessage={queryText(params.message)}
    />
  );
}
