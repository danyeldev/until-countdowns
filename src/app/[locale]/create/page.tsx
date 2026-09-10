import type { Metadata } from "next";
import { CreateForm } from "@/components/CreateForm";
import { MineList } from "@/components/MineList";
import { i18n, localePage } from "@/lib/i18n/server";

/**
 * No `buildMetadata()` here on purpose: the page is a tool rather than an answer to a query, so it
 * carries a title and a description and no canonical or hreflang cluster — same as before, only in
 * the reader's language.
 */
export async function generateMetadata(): Promise<Metadata> {
  const L = await i18n();
  return {
    title: L.m.pages.create.title,
    description: L.m.pages.create.description,
  };
}

export default async function CreatePage() {
  const L = await localePage();
  const m = L.m.pages.create;

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.24em] text-amber">{m.eyebrow}</p>
      <h1 className="mt-3 font-serif text-4xl text-paper sm:text-5xl">{m.heading}</h1>
      <p className="mt-4 max-w-2xl text-paper-dim">{m.intro}</p>
      <div className="mt-10">
        <CreateForm
          locale={L.locale}
          m={m.form}
          categoryLabels={L.m.categories.labels}
          calendarLabels={L.m.common.actions}
          countdownLabels={L.m.embed.countdown}
          studioLabels={L.m.embed.studio}
          studioActions={L.m.common.actions}
        />
      </div>
      <MineList locale={L.locale} m={L.m.event.mine} />
    </div>
  );
}
