import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "@/components/UpdatePasswordForm";
import { loginHref } from "@/lib/auth/paths";
import { getAuthClaims } from "@/lib/auth/server";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Update password",
  description: "Choose a new password for your Until account.",
  canonical: "/login/update-password",
  ogPath: "/og/default",
  noindex: true,
});

export default async function UpdatePasswordPage() {
  if (!(await getAuthClaims())) {
    redirect(loginHref("/", { mode: "reset", error: "Open the reset link from your email to choose a new password." }));
  }
  return <UpdatePasswordForm />;
}
