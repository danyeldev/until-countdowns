import { redirect } from "next/navigation";
import { CompleteProfileForm } from "@/components/CompleteProfileForm";
import { isStaleAuthSession } from "@/lib/auth/messages";
import { loginHref, safeNextPath } from "@/lib/auth/paths";
import { createAuthServerClient, getOwnProfile, profileIsComplete } from "@/lib/auth/server";
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
  const supabase = await createAuthServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (!data.user) {
    if (isStaleAuthSession(error)) {
      await supabase.auth.signOut({ scope: "local" });
      redirect(loginHref(next, { error: "This sign-in is no longer valid. Sign in again." }));
    }
    redirect(loginHref(next, { mode: "signup" }));
  }
  const profile = await getOwnProfile();
  if (profileIsComplete(profile)) redirect(next);
  return <CompleteProfileForm next={next} initialName={profile?.name ?? ""} initialHandle={profile?.handle ?? ""} />;
}
