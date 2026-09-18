import { Link } from "@/i18n/navigation";
import Image from "next/image";
import type { CountdownEvent } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/labels";
import {
  formatApproximate,
  formatCompactDate,
  isCoarsePrecision,
} from "@/lib/time";
import { Countdown } from "./Countdown";
import { ImageCredit } from "./ImageCredit";
import { StatusBadge } from "./StatusBadge";
import { SaveButton } from "./SaveButton";
import { Icon } from "./Icon";
import { HypeLabel } from "./HypeLabel";
import { imageUrl } from "@/lib/images";

export function FeaturedHero({ event }: { event: CountdownEvent }) {
  const backdrop = event.image ?? undefined;
  const when = isCoarsePrecision(event.datePrecision)
    ? formatApproximate(event.date, event.datePrecision)
    : formatCompactDate(event.date, event.timezone);
  return (
    <section className="hero-art flex min-h-[400px] min-w-0 flex-col p-6 sm:p-8">
      <Image
        src={backdrop ? imageUrl(backdrop, "hero") : "/art/until-sculpture.webp"}
        alt=""
        fill
        preload
        unoptimized
        sizes="(max-width: 1280px) 100vw, 850px"
        className="pointer-events-none -z-20 object-cover object-right"
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-[#111019]/95 via-[#111019]/80 to-[#111019]/10" />
      <div className="flex items-center justify-between gap-3">
        <span className="pill !border-white/15 !bg-black/15 !text-white/90">
          <Icon name="spark" size={13} />{" "}
          {event.hype ? "Heating up" : "In the spotlight"}
        </span>
        <StatusBadge status={event.status} />
      </div>
      <div className="my-auto py-6">
        <p className="mb-3 flex flex-wrap items-center gap-x-2 text-xs text-paper-dim">
          <span>{CATEGORY_LABELS[event.category]}</span>
          <span className="text-muted">·</span>
          <time dateTime={event.date}>{when}</time>
          {event.hype ? (
            <>
              <span className="text-muted">·</span>
              <HypeLabel points={event.hype} className="!text-amber" />
            </>
          ) : null}
        </p>
        <h2 className="max-w-xl text-[clamp(1.65rem,3vw,2.6rem)] font-semibold leading-[1.08] tracking-[-.055em]">
          <Link href={`/event/${event.slug}`} className="hover:text-amber">
            {event.title}
          </Link>
        </h2>
        <div className="mt-7 max-w-lg">
          <Countdown
            date={event.date}
            allDay={event.allDay}
            size="hero"
            initialDays={event.daysUntil}
            precision={event.datePrecision}
            status={event.status}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/event/${event.slug}`} className="button-primary">
          Open countdown <Icon name="arrow" size={16} />
        </Link>
        <SaveButton id={event.id} event={event} />
      </div>
      {backdrop && <ImageCredit image={backdrop} className="mt-3" />}
    </section>
  );
}
