import { catalogMeta } from "@/lib/catalog";

export function Footer() {
  const meta = catalogMeta();
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-serif text-paper-dim">Until — a catalog of things that haven’t happened yet.</p>
        <p>
          {meta.count.toLocaleString()} dates · sources: Nager.Date, Wikipedia, Wikidata, curated
        </p>
      </div>
    </footer>
  );
}
