import { redirect } from "next/navigation";
import { CompleteProfileForm } from "@/components/CompleteProfileForm";
import { loginHref, safeNextPath } from "@/lib/auth/paths";
import { getAuthClaims, getOwnProfile, profileIsComplete } from "@/lib/auth/server";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Your profile",
  description: "Choose your name and handle on Until.",
  canonical: "/login/complete",
  ogPath: "/og/default",
  noindex: true,
});

export default async function CompleteProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeNextPath((await searchParams).next);
  if (!(await getAuthClaims())) redirect(loginHref(next, { mode: "signup" }));
  const profile = await getOwnProfile();
  if (profileIsComplete(profile)) redirect(next);
  return <CompleteProfileForm next={next} initialName={profile?.name ?? ""} initialHandle={profile?.handle ?? ""} />;
}
