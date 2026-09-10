"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarButtons } from "@/components/CalendarButtons";
import { Countdown } from "@/components/Countdown";
import { EmbedStudio } from "@/components/EmbedStudio";
import { CATEGORIES, type Category } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/labels";
import { absoluteUrl, siteUrl } from "@/lib/seo";
import { isValidDate } from "@/lib/time";
import { encodeSharePayload, upsertMine, userEventFromDraft } from "@/lib/user-events";

export function CreateForm() {
  const [title, setTitle] = useState("Something I am waiting for");
  const [date, setDate] = useState("2027-01-01");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("culture");
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  const event = useMemo(
    () => userEventFromDraft({ title, date, description, category }),
    [title, date, description, category],
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
          <span className="text-xs uppercase tracking-[0.16em] text-muted">Title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-ink-2 px-4 py-3 text-paper outline-none focus:border-amber/60"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.16em] text-muted">Date</span>
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
          <span className="text-xs uppercase tracking-[0.16em] text-muted">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="mt-2 w-full rounded-xl border border-line bg-ink-2 px-4 py-3 text-paper outline-none focus:border-amber/60"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.16em] text-muted">Note</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Why this date matters to you."
            className="mt-2 w-full rounded-xl border border-line bg-ink-2 px-4 py-3 text-paper outline-none placeholder:text-muted focus:border-amber/60"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-full bg-amber px-5 py-2.5 text-sm font-medium text-ink hover:bg-paper"
          >
            Save on this device
          </button>
          {shareable && (
            <Link
              href={sharePath}
              className="rounded-full border border-line px-5 py-2.5 text-sm text-paper hover:border-amber/50"
            >
              Open shareable page
            </Link>
          )}
        </div>
        {savedSlug && (
          <p className="text-sm text-moss">
            Saved.{" "}
            <Link href={`/event/${savedSlug}`} className="underline">
              View it
            </Link>{" "}
            — it lives in this browser until you clear storage.
          </p>
        )}
        <p className="text-xs text-muted">
          Custom countdowns stay on your device (no account). The share link encodes the title and date in the URL.
        </p>
      </form>

      <aside className="ticket rounded-3xl p-6 sm:p-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-amber">Live preview</p>
        <h2 className="mt-3 font-serif text-3xl text-paper">{event.title}</h2>
        <p className="mt-2 text-sm text-paper-dim">{event.description}</p>
        <div className="mt-8">
          {isValidDate(event.date) ? (
            <Countdown date={event.date} allDay />
          ) : (
            <p className="text-sm text-muted">Choose a date to start the clock.</p>
          )}
        </div>
        {isValidDate(event.date) && (
          <div className="mt-8">
            <CalendarButtons event={event} url={absoluteUrl(sharePath)} />
          </div>
        )}
      </aside>

      {shareable && (
        <div className="lg:col-span-2">
          <EmbedStudio slug={shareSlug} title={event.title} origin={siteUrl()} />
        </div>
      )}
    </div>
  );
}
