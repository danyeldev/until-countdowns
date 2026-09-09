"use client";

import Link from "next/link";
import type { CountdownEvent } from "@/lib/types";
import { encodeSharePayload } from "@/lib/user-events";
import { useMine } from "@/lib/use-local-store";
import { CalendarButtons } from "./CalendarButtons";
import { Countdown } from "./Countdown";
import { SaveButton } from "./SaveButton";
import { ShareButton } from "./ShareButton";
import { CATEGORY_LABELS } from "@/lib/labels";
import { formatRange } from "@/lib/time";

export function MineEvent({ slug }: { slug: string }) {
  const mine = useMine();
  const event: CountdownEvent | undefined = mine.find((e) => e.slug === slug);

  if (!event) {
    return (
      <div>
        <h1 className="font-serif text-4xl text-paper">This countdown lives on another device</h1>
        <p className="mt-4 max-w-xl text-paper-dim">
          Personal countdowns are stored in the browser that created them. If someone shared a link with you, ask them
          for the shareable URL from the create page.
        </p>
        <Link href="/create" className="mt-6 inline-block text-amber underline">
          Make a new one
        </Link>
      </div>
    );
  }

  const sharePath = `/event/share-${encodeSharePayload(event)}`;

  return (
    <article>
      <p className="text-[11px] uppercase tracking-[0.24em] text-amber">{CATEGORY_LABELS[event.category]}</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight text-paper sm:text-6xl">{event.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-paper-dim">{event.description}</p>
      <p className="mt-3 font-mono text-sm text-muted">{formatRange(event.date, event.endDate)}</p>
      <div className="ticket mt-10 rounded-3xl px-6 py-10 sm:px-10">
        <Countdown date={event.date} allDay={event.allDay} size="hero" />
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <CalendarButtons event={event} />
        <SaveButton id={event.id} />
        <ShareButton title={event.title} path={sharePath} />
      </div>
    </article>
  );
}
