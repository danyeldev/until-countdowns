import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CollectionCard } from "@/components/CollectionCard";
import { Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { getOwnProfile } from "@/lib/auth/server";
import { parseProfileParam, profileHref } from "@/lib/auth/profile";
import { getPublicProfile } from "@/lib/auth/public-profile";
import { listPublicCollectionsServer } from "@/lib/collections-server";
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
  const collections = await listPublicCollectionsServer(profile.handle);

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
          ? "This is your public page. Saved dates stay with your account. Collections you publish appear here."
          : `${profile.name} is counting down on Until. Public collections appear below.`}
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        {isOwn ? (
          <>
            <Link href="/collections/new" className="button-primary">
              New collection <Icon name="arrow" />
            </Link>
            <Link href="/saved" className="button-secondary">
              Your space
            </Link>
          </>
        ) : (
          <Link href="/create" className="button-secondary">
            <Icon name="plus" /> Make your own
          </Link>
        )}
      </div>
      <section className="mt-10">
        <h2 className="section-heading">Collections</h2>
        {collections.length ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {collections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-paper-dim">
            {isOwn ? "Publish a collection to share a list of countdowns." : `${profile.name} has not published a collection yet.`}
          </p>
        )}
      </section>
    </article>
  );
}
