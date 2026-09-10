"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { bind } from "@/lib/i18n/bind";
import type { Locale } from "@/lib/i18n/config";
import type { Category, CountdownEvent } from "@/lib/types";
import { encodeSharePayload } from "@/lib/user-events";
import { useMine } from "@/lib/use-local-store";
import { CalendarButtons } from "./CalendarButtons";
import { Countdown } from "./Countdown";
import { EmbedStudio } from "./EmbedStudio";
import { SaveButton } from "./SaveButton";
import { ShareButton } from "./ShareButton";
import { absoluteUrl, siteUrl } from "@/lib/seo";

/**
 * Everything the page renders is either the reader's own words or a message the server parent
 * handed over: the countdown itself only exists in this browser, so the page cannot be rendered
 * on the server and cannot reach the catalogue.
 */
type Messages = {
  dateRange: string;
  mine: { missingTitle: string; missingBody: string; makeNew: string };
};

export function MineEvent({
  slug,
  locale,
  m,
  actions,
  labels,
  categories,
  countdownLabels,
  studioLabels,
}: {
  slug: string;
  locale: Locale;
  m: Messages;
  /** `L.m.common.actions` whole: every button on this page draws its word from it. */
  actions: ComponentProps<typeof CalendarButtons>["labels"] &
    ComponentProps<typeof ShareButton>["labels"] &
    ComponentProps<typeof SaveButton>["labels"] &
    ComponentProps<typeof EmbedStudio>["actions"];
  labels: { dateToBeAnnounced: string };
  categories: Record<Category, string>;
  /** The clock and the studio own their own words; typed from the components so they cannot drift. */
  countdownLabels: ComponentProps<typeof Countdown>["labels"];
  studioLabels: ComponentProps<typeof EmbedStudio>["labels"];
}) {
  const L = bind(locale);
  const mine = useMine();
  const event: CountdownEvent | undefined = mine.find((e) => e.slug === slug);

  if (!event) {
    return (
      <div>
        <h1 className="font-serif text-4xl text-paper">{m.mine.missingTitle}</h1>
        <p className="mt-4 max-w-xl text-paper-dim">{m.mine.missingBody}</p>
        <Link href={L.href("/create")} className="mt-6 inline-block text-amber underline">
          {m.mine.makeNew}
        </Link>
      </div>
    );
  }

  const shareSlug = `share-${encodeSharePayload(event)}`;
  const sharePath = L.href(`/event/${shareSlug}`);
  const when =
    event.endDate && event.endDate !== event.date
      ? L.t(m.dateRange, { start: L.fmt.compactDate(event.date), end: L.fmt.compactDate(event.endDate) })
      : L.fmt.whenDate(event.date, true, labels.dateToBeAnnounced);

  return (
    <article>
      <p className="text-[11px] uppercase tracking-[0.24em] text-amber">{categories[event.category]}</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight text-paper sm:text-6xl">{event.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-paper-dim">{event.description}</p>
      <p className="mt-3 font-mono text-sm text-muted">{when}</p>
      <div className="ticket mt-10 rounded-3xl px-6 py-10 sm:px-10">
        <Countdown date={event.date} allDay={event.allDay} size="hero" locale={locale} labels={countdownLabels} />
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <CalendarButtons event={event} url={absoluteUrl(sharePath)} labels={actions} />
        <SaveButton id={event.id} labels={actions} />
        <ShareButton title={event.title} path={sharePath} labels={actions} />
      </div>
      {/* The embed points at the payload URL, never at this `mine-…` slug: the widget has to work
          on someone else's site, where this browser's localStorage does not exist. */}
      <EmbedStudio slug={shareSlug} title={event.title} origin={siteUrl()} labels={studioLabels} actions={actions} />
    </article>
  );
}
