import type { ReactNode } from "react";
import Image from "next/image";
import { Countdown } from "./Countdown";
import { EventImage } from "./EventImage";
import { Icon } from "./Icon";
import { ImageCredit } from "./ImageCredit";
import { StatusBadge } from "./StatusBadge";
import { formatApproximate, formatRange, isCoarsePrecision } from "@/lib/time";
import { isShareAlike } from "@/lib/images";
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
  const separateArtwork = image ? isShareAlike(image.license) : false;
  const paused =
    status === "cancelled" || status === "postponed" || status === "retired";
  return (
    <section className="relative isolate mt-4 overflow-hidden rounded-3xl">
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
        aria-hidden="true"
      >
        {image && !separateArtwork ? (
          <div className="absolute inset-y-0 end-0 w-full opacity-60 lg:w-3/4 [&>div]:h-full [&>div]:!aspect-auto [&>div]:!rounded-none [&_img]:h-full [&_img]:object-cover">
            <EventImage
              image={image}
              alt=""
              variant="hero"
              priority
              sizes="(max-width: 1024px) 100vw, 900px"
            />
          </div>
        ) : (
          <div className="absolute inset-0 opacity-60">
            <Image
              src="/art/until-sculpture.png"
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 1100px"
              preload
              className="object-cover object-right"
            />
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-r from-ink via-ink/85 to-ink/30" />
        <div className="absolute inset-0 bg-linear-to-t from-ink via-ink/20 to-transparent" />
      </div>

      <div className="px-1 py-8 sm:px-2 sm:py-10 lg:py-12">
        <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-amber">
          {kicker}
          <StatusBadge status={status} />
        </div>
        <h1 className="mt-4 max-w-4xl text-[clamp(2rem,5vw,3.75rem)] leading-[1.06] font-semibold tracking-[-0.04em] text-paper [overflow-wrap:anywhere]">
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
            <div className="max-w-xl">
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
        <figure className="px-1 pb-2 sm:px-2">
          {separateArtwork ? (
            <details className="group/photo">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm text-paper-dim hover:text-paper [&::-webkit-details-marker]:hidden">
                Event photograph
                <Icon
                  name="plus"
                  size={17}
                  className="text-muted transition-transform group-open/photo:rotate-45"
                />
              </summary>
              <div className="pt-3 pb-2">
                <EventImage
                  image={image}
                  alt={title}
                  variant="hero"
                  className="rounded-2xl"
                  sizes="(max-width: 1024px) 100vw, 1000px"
                />
              </div>
            </details>
          ) : null}
          <ImageCredit
            image={image}
            className={separateArtwork ? "mt-3" : undefined}
          />
        </figure>
      ) : null}
    </section>
  );
}
