import { Link } from "@/i18n/navigation";
import { CollectionEditor } from "@/components/CollectionEditor";
import { requireAuth } from "@/lib/auth/server";
import { localizedMetadata } from "@/lib/seo";
import { activateLocale } from "@/i18n/request-locale";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  activateLocale(locale);
  return localizedMetadata({
  title: "New collection",
  description: "Start a public collection of countdowns.",
  canonical: "/collections/new",
  ogPath: "/og/default",
  noindex: true,
    locale,
  });
}

export default async function NewCollectionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  activateLocale(locale);
  await requireAuth("/collections/new");
  return (
    <div>
      <Link href="/collections" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-paper">
        <span aria-hidden="true">←</span> Collections
      </Link>
      <h1 className="page-heading">New collection</h1>
      <p className="page-subtitle mt-3 max-w-xl">
        Give it a title, a short note, and photos. Add countdowns from event pages after you save.
      </p>
      <div className="mt-8">
        <CollectionEditor />
      </div>
    </div>
  );
}
