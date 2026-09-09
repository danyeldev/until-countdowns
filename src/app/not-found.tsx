import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20">
      <p className="text-[11px] uppercase tracking-[0.24em] text-amber">404</p>
      <h1 className="mt-3 font-serif text-4xl text-paper">This date is not in the catalog</h1>
      <p className="mt-4 text-paper-dim">It may have been merged, renamed, or never existed.</p>
      <Link href="/" className="mt-6 inline-block text-amber underline">
        Back to everything coming
      </Link>
    </div>
  );
}
