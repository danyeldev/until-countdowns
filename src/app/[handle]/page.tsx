import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { getOwnProfile } from "@/lib/auth/server";
import { parseProfileParam, profileHref } from "@/lib/auth/profile";
import { getPublicProfile } from "@/lib/auth/public-profile";
import { profilePage } from "@/lib/jsonld";
import { buildMetadata, truncate } from "@/lib/seo";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: PageProps<"/[handle]">): Promise<Metadata> {
  const { handle: raw } = await params;
  const handle = parseProfileParam(raw);
  const profile = handle ? await getPublicProfile(handle) : null;
  if (!profile) return { title: "Profile", robots: { index: false, follow: true } };
  return buildMetadata({
    title: `${profile.name} (@${profile.handle})`,
    description: truncate(`${profile.name} is on Until as @${profile.handle}. Save dates and make countdowns.`),
    canonical: profileHref(profile.handle),
    ogPath: "/og/default",
    ogAlt: `${profile.name} on Until`,
  });
}

export default async function PublicProfilePage({ params }: PageProps<"/[handle]">) {
  const { handle: raw } = await params;
  const handle = parseProfileParam(raw);
  if (!handle) notFound();
  if (raw !== handle) permanentRedirect(profileHref(handle));

  const profile = await getPublicProfile(handle);
  if (!profile) notFound();

  const own = await getOwnProfile();
  const isOwn = own?.handle === profile.handle;
  const initial = profile.name.slice(0, 1).toLocaleUpperCase();

  return (
    <article>
      <Breadcrumbs items={[{ name: "Until", path: "/" }, { name: `@${profile.handle}`, path: profileHref(profile.handle) }]} />
      <JsonLd data={profilePage(profile.name, profile.handle)} />
      <p className="eyebrow mt-6">On Until</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-amber/15 text-2xl font-medium text-amber">
          {initial}
        </span>
        <div className="min-w-0">
          <h1 className="page-heading">{profile.name}</h1>
          <p className="mt-2 text-sm text-amber">@{profile.handle}</p>
        </div>
      </div>
      <p className="page-subtitle mt-6 max-w-xl">
        {isOwn
          ? "This is your public page. Your collection stays with your account; share a countdown when you want someone else to see it."
          : `${profile.name} is counting down on Until. Collections stay private unless someone shares a link.`}
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        {isOwn ? (
          <>
            <Link href="/create" className="button-primary">
              Create a countdown <Icon name="arrow" />
            </Link>
            <Link href="/saved" className="button-secondary">
              Your collection
            </Link>
          </>
        ) : (
          <Link href="/create" className="button-secondary">
            <Icon name="plus" /> Make your own
          </Link>
        )}
      </div>
    </article>
  );
}
