"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, type ComponentProps } from "react";
import { CalendarButtons } from "@/components/CalendarButtons";
import { Countdown } from "@/components/Countdown";
import { EmbedStudio } from "@/components/EmbedStudio";
import { bind } from "@/lib/i18n/bind";
import type { Locale } from "@/lib/i18n/config";
import { localeUrl, siteUrl } from "@/lib/seo";
import { isValidDate } from "@/lib/time";
import { CATEGORIES, type Category } from "@/lib/types";
import { encodeSharePayload, upsertMine, userEventFromDraft } from "@/lib/user-events";

/** `L.m.pages.create.form`, handed over by the server parent — a Client Component cannot read the catalogue. */
type Messages = {
  draftTitle: string;
  draftNote: string;
  titleLabel: string;
  dateLabel: string;
  categoryLabel: string;
  noteLabel: string;
  notePlaceholder: string;
  save: string;
  openShareable: string;
  saved: string;
  savedLink: string;
  privacy: string;
  previewLabel: string;
  chooseDate: string;
};

/** Fills a message whose placeholder is an element, so the saved line stays one sentence. */
function fillNodes(template: string, parts: Record<string, React.ReactNode>): React.ReactNode[] {
  return template.split(/(\{\w+\})/g).map((chunk, i) => {
    const key = /^\{(\w+)\}$/.exec(chunk)?.[1];
    return key && key in parts ? <Fragment key={i}>{parts[key]}</Fragment> : chunk;
  });
}

export function CreateForm({
  locale,
  m,
  categoryLabels,
  calendarLabels,
  countdownLabels,
  studioLabels,
  studioActions,
}: {
  locale: Locale;
  m: Messages;
  categoryLabels: Record<Category, string>;
  calendarLabels: { google: string; outlook: string; downloadIcs: string };
  /** The clock and the studio own their own words; typed from the components so they cannot drift. */
  countdownLabels: ComponentProps<typeof Countdown>["labels"];
  studioLabels: ComponentProps<typeof EmbedStudio>["labels"];
  studioActions: ComponentProps<typeof EmbedStudio>["actions"];
}) {
  const L = bind(locale);
  const [title, setTitle] = useState(m.draftTitle);
  const [date, setDate] = useState("2027-01-01");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("culture");
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  const event = useMemo(
    // `userEventFromDraft` has an English stand-in for an empty note, which the share payload and
    // the `.ics` need; the reader is looking at the preview, so the note is filled in their
    // language before it gets there.
    () => userEventFromDraft({ title, date, description: description || m.draftNote, category }),
    [title, date, description, category, m.draftNote],
  );

  const shareSlug = `share-${encodeSharePayload(event)}`;
  const sharePath = `/event/${shareSlug}`;
  // A payload without a title decodes to nothing (`decodeSharePayload` needs both), so an empty
  // Title field would otherwise hand out a share link and an embed that 404 for good.
  const shareable = Boolean(event.title.trim()) && isValidDate(event.date);

  function onSave() {
    upsertMine(event);
    setSavedSlug(event.slug);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <label className="block">
          <span className="text-xs uppercase tracking-[0.16em] text-muted">{m.titleLabel}</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-ink-2 px-4 py-3 text-paper outline-none focus:border-amber/60"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.16em] text-muted">{m.dateLabel}</span>
          <input
            required
            type="date"
            value={date}
            onChange={(e) => {
              const next = e.target.value;
              if (next === "" || isValidDate(next)) setDate(next);
            }}
            className="mt-2 w-full rounded-xl border border-line bg-ink-2 px-4 py-3 text-paper outline-none focus:border-amber/60"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.16em] text-muted">{m.categoryLabel}</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="mt-2 w-full rounded-xl border border-line bg-ink-2 px-4 py-3 text-paper outline-none focus:border-amber/60"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabels[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.16em] text-muted">{m.noteLabel}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder={m.notePlaceholder}
            className="mt-2 w-full rounded-xl border border-line bg-ink-2 px-4 py-3 text-paper outline-none placeholder:text-muted focus:border-amber/60"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-full bg-amber px-5 py-2.5 text-sm font-medium text-ink hover:bg-paper"
          >
            {m.save}
          </button>
          {shareable && (
            <Link
              href={L.href(sharePath)}
              className="rounded-full border border-line px-5 py-2.5 text-sm text-paper hover:border-amber/50"
            >
              {m.openShareable}
            </Link>
          )}
        </div>
        {savedSlug && (
          <p className="text-sm text-moss">
            {fillNodes(m.saved, {
              link: (
                <Link href={L.href(`/event/${savedSlug}`)} className="underline">
                  {m.savedLink}
                </Link>
              ),
            })}
          </p>
        )}
        <p className="text-xs text-muted">{m.privacy}</p>
      </form>

      <aside className="ticket rounded-3xl p-6 sm:p-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-amber">{m.previewLabel}</p>
        <h2 className="mt-3 font-serif text-3xl text-paper">{event.title}</h2>
        <p className="mt-2 text-sm text-paper-dim">{event.description}</p>
        <div className="mt-8">
          {isValidDate(event.date) ? (
            <Countdown date={event.date} allDay locale={locale} labels={countdownLabels} />
          ) : (
            <p className="text-sm text-muted">{m.chooseDate}</p>
          )}
        </div>
        {isValidDate(event.date) && (
          <div className="mt-8">
            {/* The calendar entry links back to the share page as this reader's locale publishes it. */}
            <CalendarButtons event={event} url={localeUrl(locale, sharePath)} labels={calendarLabels} />
          </div>
        )}
      </aside>

      {shareable && (
        <div className="lg:col-span-2">
          <EmbedStudio slug={shareSlug} title={event.title} origin={siteUrl()} labels={studioLabels} actions={studioActions} />
        </div>
      )}
    </div>
  );
}
