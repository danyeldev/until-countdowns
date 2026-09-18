import type { ReactNode } from "react";
import Image from "next/image";
import { Countdown } from "./Countdown";
import { EventImage } from "./EventImage";
import { Icon } from "./Icon";
import { ImageCredit } from "./ImageCredit";
import { StatusBadge } from "./StatusBadge";
import { formatApproximate, formatRange, isCoarsePrecision } from "@/lib/time";
import type {
  DatePrecision,
  EventImage as EventArtwork,
  EventStatus,
} from "@/lib/types";

/** Shared server-rendered stage; only the clock and its actions hydrate. */
export function DetailHero({
  title,
  kicker,
  date,
  endDate,
  allDay = true,
  timezone,
  initialDays,
  precision,
  status,
  image,
  hype,
  actions,
}: {
  title: string;
  kicker: ReactNode;
  date?: string;
  endDate?: string;
  allDay?: boolean;
  timezone?: string;
  initialDays?: number;
  precision?: DatePrecision;
  status?: EventStatus;
  image?: EventArtwork;
  hype?: ReactNode;
  actions: ReactNode;
}) {
  const coarse = isCoarsePrecision(precision);
  const paused =
    status === "cancelled" || status === "postponed" || status === "retired";
  return (
    <section className="panel relative isolate mt-5 rounded-[28px] border border-line bg-ink-2">
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
        aria-hidden="true"
      >
        {image ? (
          <div className="absolute inset-y-0 right-0 w-full opacity-90 lg:w-3/4 [&>div]:h-full [&>div]:!aspect-auto [&_img]:h-full [&_img]:object-cover">
            <EventImage
              image={image}
              alt=""
              variant="hero"
              priority
              sizes="(max-width: 1024px) 100vw, 900px"
            />
          </div>
        ) : (
          <div className="absolute inset-0 opacity-55">
            <Image
              src="/art/until-sculpture.webp"
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 1100px"
              preload
              unoptimized
              className="object-cover object-right"
            />
          </div>
        )}
        {/* The photo is the point of the stage: the scrims only keep the title column readable. */}
        <div
          className={`absolute inset-0 bg-linear-to-r from-ink-2 from-10% to-transparent ${
            image ? "via-ink-2/55 via-40%" : "via-ink-2/90"
          }`}
        />
        <div className="absolute inset-0 bg-linear-to-t from-ink-2 via-ink-2/25 via-35% to-transparent" />
      </div>

      <div className="px-5 py-7 sm:px-9 sm:py-9 lg:px-11 lg:py-11">
        <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-amber">
          {kicker}
          <StatusBadge status={status} />
        </div>
        <h1 className="mt-4 max-w-4xl text-[clamp(2rem,5vw,3.75rem)] leading-[1.06] font-semibold tracking-[-0.045em] text-paper [overflow-wrap:anywhere]">
          {title}
        </h1>
        {date ? (
          <p className="mt-4 flex items-start gap-2.5 text-sm leading-relaxed text-paper-dim sm:text-base">
            <Icon name="calendar" className="mt-0.5 shrink-0" />
            {coarse ? (
              <span>{formatApproximate(date, precision)}</span>
            ) : (
              <time dateTime={date}>
                {formatRange(date, endDate, timezone)}
              </time>
            )}
          </p>
        ) : null}

        <div className="my-8 sm:my-10">
          {date ? (
            <Countdown
              date={date}
              allDay={allDay}
              size="hero"
              initialDays={initialDays}
              precision={precision}
              status={status}
            />
          ) : (
            <div className="max-w-xl rounded-2xl border border-line bg-ink/60 px-5 py-6">
              <p className="text-2xl font-medium tracking-tight text-paper">
                A new date is on the horizon.
              </p>
              <p className="mt-2 text-sm text-paper-dim">
                The next date hasn’t reached the catalog yet. This page will
                show it when it does.
              </p>
            </div>
          )}
          {hype}
        </div>

        <div className="flex flex-wrap items-start gap-2.5">{actions}</div>
        {date && !paused ? (
          <p className="mt-5 max-w-xl text-xs leading-relaxed text-muted">
            {coarse
              ? "The clock starts when an exact day is announced."
              : allDay
                ? "Counts to midnight on this date in your local time."
                : `Event time shown in ${timezone ?? "UTC"}. The countdown follows the same moment worldwide.`}
          </p>
        ) : null}
      </div>
      {image ? (
        <figure className="rounded-b-[28px] border-t border-line/60 bg-ink-2 px-5 py-3 sm:px-9 lg:px-11">
          <ImageCredit image={image} />
        </figure>
      ) : null}
    </section>
  );
}
