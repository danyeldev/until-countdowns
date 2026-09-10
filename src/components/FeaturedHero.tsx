import Link from "next/link";
import type { CountdownEvent } from "@/lib/types";
import type { Localized } from "@/lib/i18n/bind";
import { displayTitle, formatApproximate } from "@/lib/seo";
import { isCoarsePrecision } from "@/lib/time";
import { Countdown } from "./Countdown";
import { ImageCredit } from "./ImageCredit";
import { StatusBadge } from "./StatusBadge";
import { imageUrl } from "@/lib/images";

export function FeaturedHero({ L, event }: { L: Localized; event: CountdownEvent }) {
  const when = isCoarsePrecision(event.datePrecision)
    ? formatApproximate(L, event.date, event.datePrecision)
    : L.fmt.whenDate(event.date, event.allDay);
  const hero = event.image ? imageUrl(event.image, "hero") : null;
  return (
    <section className="ticket relative overflow-hidden rounded-3xl px-6 py-10 sm:px-10 sm:py-14">
      {/* The hero photo sits behind the text under a heavy scrim: decoration, so the plain <img>
          (no next/image sizing) is deliberate — it never affects layout. */}
      {hero ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hero}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, var(--ink) 8%, rgba(12,11,9,0.86) 46%, rgba(12,11,9,0.55) 100%)",
            }}
          />
        </>
      ) : null}
      <p className="relative flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-amber">
        {L.m.home.hero.eyebrow}
        <StatusBadge status={event.status} />
      </p>
      <h1 className="relative mt-4 max-w-3xl font-serif text-4xl leading-tight text-paper sm:text-6xl">
        {displayTitle(L, event)}
      </h1>
      <p className="relative mt-4 max-w-2xl text-paper-dim">{event.description}</p>
      <p className="relative mt-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
        {L.t(L.m.home.hero.meta, { category: L.m.categories.labels[event.category], when })}
      </p>
      <div className="relative mt-10">
        <Countdown
          date={event.date}
          allDay={event.allDay}
          size="hero"
          initialDays={event.daysUntil}
          precision={event.datePrecision}
        />
      </div>
      <Link
        href={L.href(`/event/${event.slug}`)}
        className="relative mt-10 inline-flex rounded-full bg-amber px-5 py-2.5 text-sm font-medium text-ink hover:bg-paper"
      >
        {L.m.home.hero.open}
      </Link>
      {event.image ? <ImageCredit image={event.image} className="relative mt-6" /> : null}
    </section>
  );
}
