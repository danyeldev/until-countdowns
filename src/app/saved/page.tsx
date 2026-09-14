import Link from "next/link";
import { SavedList } from "@/components/SavedList";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Your saved countdowns",
  description: "Keep the dates you are looking forward to in one place. Your saved catalog dates and personal countdowns, stored on this device.",
  canonical: "/saved",
  ogPath: "/og/default",
  noindex: true,
});

export default function SavedPage() {
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div><h1 className="page-heading">Your collection</h1><p className="page-subtitle mt-3 max-w-xl">Good things ahead. Keep your favorite dates and your own moments together.</p></div>
        <Link href="/create" className="button-primary"><span aria-hidden="true">+</span> Create countdown</Link>
      </div>
      <SavedList />
    </div>
  );
}
