"use client";

import { Link } from "@/i18n/navigation";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { CalendarButtons } from "@/components/CalendarButtons";
import { Countdown } from "@/components/Countdown";
import { PersonalDateArtwork } from "@/components/PersonalDateArtwork";
import { ShareButton } from "@/components/ShareButton";
import { CATEGORIES, type Category } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/labels";
import { absoluteUrl, siteUrl } from "@/lib/seo";
import { formatCompactDate } from "@/lib/time";
import { useCollection } from "@/components/CollectionProvider";
import { encodeSharePayload, isPersonalDate, userEventFromDraft, USER_NOTE_MAX, USER_TITLE_MAX } from "@/lib/user-events";

const EmbedStudio = dynamic(() => import("@/components/EmbedStudio").then((module) => module.EmbedStudio));
const IDEAS = ["My next adventure", "Birthday weekend", "A fresh start"];

export function CreateForm({ defaultDate = "" }: { defaultDate?: string }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(isPersonalDate(defaultDate) ? defaultDate : "");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("culture");
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const { ready, userId, upsertMine } = useCollection();

  const event = useMemo(() => userEventFromDraft({ title, date, description, category }), [title, date, description, category]);
  const payload = encodeSharePayload(event);
  const shareSlug = `share-${payload}`;
  const sharePath = `/event/${shareSlug}`;
  const valid = Boolean(event.title) && isPersonalDate(event.date);
  const shareable = valid && Boolean(payload);

  function changed() { setSavedSlug(null); setError(""); }
  function onSave() {
    setPending(true);
    void upsertMine(event)
      .then((saved) => { setSavedSlug(saved.slug); setError(""); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not save this countdown."))
      .finally(() => setPending(false));
  }

  return (
    <div className="grid items-start gap-7 xl:grid-cols-[1fr_1fr] xl:gap-10">
      <form id="countdown-editor" aria-label="Create a countdown" className="panel min-w-0 scroll-mt-24 space-y-7 p-5 sm:p-7" onSubmit={(formEvent) => { formEvent.preventDefault(); onSave(); }}>
        <div><div className="flex items-center justify-between gap-3"><h2 className="section-heading">Make it yours</h2><a href="#countdown-preview" className="inline-flex min-h-11 items-center text-sm text-amber xl:hidden">Preview <span aria-hidden="true" className="ml-2">↓</span></a></div><p className="mt-2 text-sm leading-relaxed text-muted">Give your next moment a name and a date.</p></div>
        <label className="block">
          <span className="field-label">What are you looking forward to?</span>
          <input name="title" required maxLength={USER_TITLE_MAX} value={title} onChange={(input) => { setTitle(input.target.value); changed(); }} placeholder="A trip, a birthday, a new beginning…" className="field mt-2 w-full" autoComplete="off" />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Countdown title ideas">
          {IDEAS.map((idea) => <button type="button" key={idea} onClick={() => { setTitle(idea); changed(); }} className="min-h-11 rounded-xl border border-line bg-ink px-3 py-2 text-xs text-paper-dim transition-colors hover:border-amber/50 hover:text-paper">{idea}</button>)}
        </div>
        <label className="block">
          <span className="field-label">The date</span>
          <input name="date" required type="date" min="0001-01-01" max="9999-12-31" value={date} onChange={(input) => { setDate(input.target.value); changed(); }} className="field mt-2 min-w-0 w-full" />
          <span className="mt-2 block text-xs leading-relaxed text-muted">An all-day countdown, starting at midnight in your local time.</span>
        </label>
        <details className="group rounded-2xl border border-line bg-ink/40">
          <summary className="cursor-pointer px-4 py-4 text-sm font-medium text-paper-dim">Add a note & category <span className="ml-1 font-normal text-muted">(optional)</span></summary>
          <div className="space-y-5 border-t border-line p-4">
            <label className="block"><span className="field-label">A note to remember</span><textarea name="description" maxLength={USER_NOTE_MAX} value={description} onChange={(input) => { setDescription(input.target.value); changed(); }} rows={3} placeholder="Why this moment matters." className="field mt-2 w-full resize-y" /><span className="mt-1 block text-right text-xs tabular-nums text-muted">{description.length}/{USER_NOTE_MAX}</span></label>
            <label className="block"><span className="field-label">Category</span><select name="category" value={category} onChange={(input) => { setCategory(input.target.value as Category); changed(); }} className="field mt-2 w-full">{CATEGORIES.map((value) => <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>)}</select></label>
          </div>
        </details>
        <div className="space-y-4 border-t border-line pt-6">
          <button type="submit" disabled={pending || !ready || !userId} className="button-primary w-full justify-center">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={savedSlug ? "m5 12 4 4L19 6" : "M12 5v14M5 12h14"} /></svg>
            {pending ? "Saving…" : !ready ? "Opening your account…" : savedSlug ? "Saved to your collection" : "Save countdown"}
          </button>
          {error && <p role="alert" className="rounded-xl border border-line bg-ink p-4 text-sm leading-relaxed text-paper">{error}</p>}
          {savedSlug && <div role="status" className="rounded-xl border border-amber/25 bg-amber/10 p-4 text-sm text-paper"><p>Ready whenever you are.</p><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2"><Link href={`/event/${savedSlug}`} className="text-amber underline underline-offset-4">Open countdown</Link><Link href="/saved" className="text-amber underline underline-offset-4">View collection</Link></div></div>}
          <p className="text-xs leading-relaxed text-muted">Saved to your account so you can open it on any device. Share links include your title, date, category and note, so anyone with the link can read them.</p>
        </div>
      </form>

      <aside id="countdown-preview" className="min-w-0 scroll-mt-24 xl:sticky xl:top-24" aria-label="Countdown preview">
        <div className="mb-3 flex items-center justify-between px-1"><p className="text-sm font-medium text-paper-dim">Your countdown</p><span className="flex items-center gap-2 text-xs text-muted"><span className="size-1.5 rounded-full bg-amber" aria-hidden="true" />Live preview</span></div>
        <div className="panel overflow-hidden">
          <PersonalDateArtwork date={event.date} />
          <div className="p-6 sm:p-8">
            <p className="text-xs font-medium text-amber">{CATEGORY_LABELS[category]}</p>
            <h2 className="mt-3 break-words text-3xl font-semibold leading-tight tracking-tight text-paper sm:text-4xl">{event.title || "Something worth waiting for."}</h2>
            <p className="mt-3 text-sm text-muted">{isPersonalDate(event.date) ? formatCompactDate(event.date) : "Choose your date"}</p>
            <div className="my-7 border-y border-line py-7">{isPersonalDate(event.date) ? <Countdown date={event.date} allDay /> : <p className="py-2 text-sm text-muted">Your countdown starts with a date.</p>}</div>
            {description.trim() && <p className="mb-6 whitespace-pre-wrap break-words text-sm leading-relaxed text-paper-dim">{description.trim()}</p>}
            {shareable ? <div className="space-y-5"><div className="flex flex-wrap items-start gap-2"><ShareButton title={event.title} path={sharePath} /><Link href={sharePath} className="button-secondary">Open preview <span aria-hidden="true">↗</span></Link></div><CalendarButtons event={event} url={absoluteUrl(sharePath)} /></div> : <p className="text-sm leading-relaxed text-muted">{valid ? "This countdown can be saved here. Shorten your title or note to create a shareable link." : "Add a title to unlock sharing and calendar links."}</p>}
          </div>
        </div>
        <a href="#countdown-editor" className="mt-3 inline-flex min-h-11 items-center text-sm text-amber xl:hidden"><span aria-hidden="true" className="mr-2">↑</span>Back to editing</a>
        {shareable && <div className="mt-4"><button type="button" aria-expanded={showEmbed} aria-controls="create-embed" onClick={() => setShowEmbed((value) => !value)} className="button-secondary w-full justify-between">Embed on a website <span aria-hidden="true">{showEmbed ? "−" : "+"}</span></button>{showEmbed && <div id="create-embed" className="mt-4"><EmbedStudio slug={shareSlug} title={event.title} origin={siteUrl()} /></div>}</div>}
      </aside>
    </div>
  );
}
