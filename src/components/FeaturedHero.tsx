import Link from "next/link";
import type { CountdownEvent } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/labels";
import { formatWhen } from "@/lib/time";
import { Countdown } from "./Countdown";

export function FeaturedHero({ event }: { event: CountdownEvent }) {
  return (
    <section className="ticket relative overflow-hidden rounded-3xl px-6 py-10 sm:px-10 sm:py-14">
      <p className="text-[11px] uppercase tracking-[0.28em] text-amber">Featured countdown</p>
      <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight text-paper sm:text-6xl">
        {event.title}
      </h1>
      <p className="mt-4 max-w-2xl text-paper-dim">{event.description}</p>
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
        {CATEGORY_LABELS[event.category]} · {formatWhen(event.date, event.allDay)}
      </p>
      <div className="mt-10">
        <Countdown date={event.date} allDay={event.allDay} size="hero" />
      </div>
      <Link
        href={`/event/${event.slug}`}
        className="mt-10 inline-flex rounded-full bg-amber px-5 py-2.5 text-sm font-medium text-ink hover:bg-paper"
      >
        Open this countdown
      </Link>
    </section>
  );
}
