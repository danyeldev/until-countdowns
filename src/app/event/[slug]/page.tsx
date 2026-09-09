import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarButtons } from "@/components/CalendarButtons";
import { Countdown } from "@/components/Countdown";
import { EventCard } from "@/components/EventCard";
import { MineEvent } from "@/components/MineEvent";
import { SaveButton } from "@/components/SaveButton";
import { ShareButton } from "@/components/ShareButton";
import { getEvent, relatedEvents, regionLabel } from "@/lib/catalog";
import { CATEGORY_LABELS } from "@/lib/labels";
import { formatRange } from "@/lib/time";
import { decodeSharePayload } from "@/lib/user-events";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  if (slug.startsWith("mine-")) return { title: "Your countdown" };
  if (slug.startsWith("share-")) {
    const shared = decodeSharePayload(slug.slice("share-".length));
    return { title: shared?.title ?? "Shared countdown" };
  }
  const event = getEvent(slug);
  if (!event) return { title: "Countdown" };
  return { title: event.title, description: event.description };
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;

  if (slug.startsWith("mine-")) {
    return <MineEvent slug={slug} />;
  }

  const event = slug.startsWith("share-")
    ? decodeSharePayload(slug.slice("share-".length))
    : getEvent(slug);
  if (!event) notFound();

  const related = event.source === "user" ? [] : relatedEvents(event, 6);
  const sharePath = `/event/${event.slug}`;

  return (
    <article>
      <p className="text-[11px] uppercase tracking-[0.24em] text-amber">
        <Link href={`/?category=${event.category}`} className="hover:text-paper">
          {CATEGORY_LABELS[event.category]}
        </Link>
      </p>
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

      <dl className="mt-10 grid gap-6 border-t border-line pt-8 text-sm sm:grid-cols-3">
        <div>
          <dt className="uppercase tracking-[0.16em] text-muted">Where</dt>
          <dd className="mt-2 text-paper-dim">
            {event.regions.includes("GLOBAL") && event.regions.length === 1
              ? "Worldwide"
              : event.regions
                  .filter((r) => r !== "GLOBAL")
                  .slice(0, 24)
                  .map(regionLabel)
                  .join(", ")}
            {event.regions.filter((r) => r !== "GLOBAL").length > 24
              ? ` +${event.regions.length - 24}`
              : ""}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.16em] text-muted">Tags</dt>
          <dd className="mt-2 flex flex-wrap gap-2">
            {event.tags.length === 0 ? (
              <span className="text-paper-dim">—</span>
            ) : (
              event.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/?q=${encodeURIComponent(tag)}`}
                  className="rounded-full border border-line px-2 py-0.5 text-xs text-paper-dim hover:text-paper"
                >
                  {tag}
                </Link>
              ))
            )}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.16em] text-muted">Source</dt>
          <dd className="mt-2 text-paper-dim">
            {event.sourceUrl ? (
              <a href={event.sourceUrl} className="underline" target="_blank" rel="noreferrer">
                {event.source}
              </a>
            ) : (
              event.source
            )}
          </dd>
        </div>
      </dl>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="font-serif text-2xl text-paper">Also coming</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <EventCard key={item.id} event={item} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
