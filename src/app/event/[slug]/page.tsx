import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CalendarButtons } from "@/components/CalendarButtons";
import { Countdown } from "@/components/Countdown";
import { EmbedStudio } from "@/components/EmbedStudio";
import { EventCard } from "@/components/EventCard";
import { EventImage } from "@/components/EventImage";
import { EventTable } from "@/components/EventTable";
import { FallbackCard } from "@/components/FallbackCard";
import { ImageCredit } from "@/components/ImageCredit";
import { IntentAnswer } from "@/components/IntentAnswer";
import { JsonLd } from "@/components/JsonLd";
import { MineEvent } from "@/components/MineEvent";
import { SaveButton } from "@/components/SaveButton";
import { ShareButton } from "@/components/ShareButton";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getEvent,
  getEventStrict,
  relatedEvents,
  resolveSlugAliasStrict,
  seriesOccurrences,
  summaryCitation,
  topSlugs,
} from "@/lib/catalog";
import { eventJsonLd, type Crumb } from "@/lib/jsonld";
import { CATEGORY_LABELS, sourceLabel } from "@/lib/labels";
import { COUNTRY_NAMES, regionLabel } from "@/lib/regions";
import {
  absoluteUrl,
  buildMetadata,
  eventDescription,
  eventTitle,
  formatLongDate,
  oembedDiscoveryUrl,
  ogDatedPath,
  siteUrl,
  todayUtc,
  truncate,
} from "@/lib/seo";
import { formatApproximate, formatCompactDate, formatRange, isCoarsePrecision } from "@/lib/time";
import type { CountdownEvent } from "@/lib/types";
import { decodeSharePayload } from "@/lib/user-events";

export const revalidate = 3600;

const OTHER_YEARS = 6;

/**
 * Prerenders the most popular upcoming slugs. An empty array is fine under ISR
 * (every path then renders on first visit; `dynamicParams` stays true), so a build with an
 * empty or unreachable database prerenders nothing rather than a set of cached 404s.
 */
export async function generateStaticParams() {
  const slugs = await topSlugs(500);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/event/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (slug.startsWith("mine-")) return { title: "Your countdown", robots: { index: false, follow: false } };
  if (slug.startsWith("share-")) {
    const payload = slug.slice("share-".length);
    const shared = decodeSharePayload(payload);
    if (!shared) return { title: "Shared countdown", robots: { index: false, follow: false } };
    return buildMetadata({
      title: `${shared.title} — ${formatLongDate(shared.date)} countdown`,
      description: `${shared.title} is on ${formatLongDate(shared.date)}. A countdown someone made on Until.`,
      canonical: `/event/${slug}`,
      ogPath: `/og/share/${encodeURIComponent(payload)}`,
      noindex: true,
    });
  }
  const event = await getEvent(slug);
  if (!event) return { title: "Countdown", robots: { index: false, follow: true } };
  const metadata = buildMetadata({
    title: eventTitle(event),
    description: eventDescription(event),
    canonical: `/event/${event.slug}`,
    ogPath: ogDatedPath("event", event.slug, todayUtc()),
    // Series members point at the evergreen series page; incomplete rows stay out of the index.
    noindex: event.indexable === false || Boolean(event.seriesSlug),
  });
  metadata.alternates = {
    ...metadata.alternates,
    types: {
      "text/calendar": absoluteUrl(`/api/ics/${event.slug}`),
      // Advertised only where there is a clock to embed: a coarse date has none, and a consumer
      // that follows the link into a 404 shows the reader an embed error rather than a plain link.
      ...(isCoarsePrecision(event.datePrecision)
        ? {}
        : { "application/json+oembed": oembedDiscoveryUrl(`/event/${event.slug}`) }),
    },
  };
  return metadata;
}

function Provenance({ event }: { event: CountdownEvent }) {
  const label = event.sourceLabel || sourceLabel(event.source);
  const verified = event.lastVerifiedAt ? formatCompactDate(event.lastVerifiedAt.slice(0, 10)) : null;
  return (
    <p className="mt-8 text-xs text-muted">
      Source:{" "}
      {event.sourceUrl ? (
        <a href={event.sourceUrl} className="underline hover:text-paper" target="_blank" rel="noreferrer">
          {label}
        </a>
      ) : (
        label
      )}
      {verified ? ` · last verified ${verified}` : ""}
      {" · "}
      <Link href="/attributions" className="underline hover:text-paper">
        attributions
      </Link>
    </p>
  );
}

/**
 * Wikipedia prose is CC BY-SA 4.0: whenever the enrichment queue filled `summary` from an article
 * (`external_ids.summary_source === 'wikipedia'`), the page has to say so and link the article.
 */
function WikipediaCredit({ article }: { article: string }) {
  const href = `https://en.wikipedia.org/wiki/${encodeURIComponent(article.replace(/ /g, "_"))}`;
  return (
    <p className="mt-2 text-xs text-muted">
      Summary from{" "}
      <a href={href} className="underline hover:text-paper" target="_blank" rel="noreferrer">
        Wikipedia
      </a>{" "}
      (
      <a
        href="https://creativecommons.org/licenses/by-sa/4.0/"
        className="underline hover:text-paper"
        target="_blank"
        rel="noreferrer license"
      >
        CC BY-SA 4.0
      </a>
      )
    </p>
  );
}

function Chip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-full border border-line px-2 py-0.5 text-xs text-paper-dim hover:text-paper">
      {children}
    </Link>
  );
}

export default async function EventPage({ params }: PageProps<"/event/[slug]">) {
  const { slug } = await params;

  if (slug.startsWith("mine-")) {
    return <MineEvent slug={slug} />;
  }

  let event: CountdownEvent | undefined;
  if (slug.startsWith("share-")) {
    event = decodeSharePayload(slug.slice("share-".length)) ?? undefined;
  } else {
    // Strict readers: a database failure throws (500, not cached) instead of becoming a
    // notFound() that ISR would keep serving for an hour on a slug that exists.
    event = await getEventStrict(slug);
    if (!event) {
      const current = await resolveSlugAliasStrict(slug);
      if (current) permanentRedirect(`/event/${current}`);
    }
  }
  if (!event) notFound();

  const isUser = event.source === "user";
  const [related, siblings, citation] = await Promise.all([
    isUser ? [] : relatedEvents(event, 6),
    event.seriesSlug ? seriesOccurrences(event.seriesSlug, OTHER_YEARS + 2) : [],
    isUser || !event.summary ? null : summaryCitation(event.slug),
  ]);
  const otherYears = siblings.filter((o) => o.slug !== event.slug).slice(0, OTHER_YEARS);
  // A shared personal countdown is reached at the payload URL it arrived on — the `mine-…` slug
  // the payload decodes to only resolves in the browser that created it, so it is not shareable.
  const shared = slug.startsWith("share-");
  const sharePath = shared ? `/event/${slug}` : `/event/${event.slug}`;
  const coarse = isCoarsePrecision(event.datePrecision);
  const shownRegions = event.regions.filter((r) => r !== "GLOBAL");
  const previousDate = event.dateHistory?.at(-1)?.date;

  const crumbs: Crumb[] = [{ name: "Home", path: "/" }];
  if (!isUser) crumbs.push({ name: CATEGORY_LABELS[event.category], path: `/category/${event.category}` });
  if (event.seriesSlug && event.seriesTitle) crumbs.push({ name: event.seriesTitle, path: `/days-until/${event.seriesSlug}` });
  crumbs.push({ name: truncate(event.title, 80), path: sharePath });

  return (
    <article>
      <Breadcrumbs items={crumbs} />
      <p className="mt-6 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-amber">
        <Link href={`/category/${event.category}`} className="hover:text-paper">
          {CATEGORY_LABELS[event.category]}
        </Link>
        <StatusBadge status={event.status} />
      </p>
      <h1 className="mt-3 font-serif text-4xl leading-tight text-paper sm:text-6xl">{event.title}</h1>
      <IntentAnswer
        className="mt-5 max-w-2xl"
        title={event.title}
        date={event.date}
        days={event.daysUntil}
        precision={event.datePrecision}
        status={event.status}
      />
      <p className="mt-4 max-w-2xl text-lg text-paper-dim">{event.description}</p>
      {event.summary && event.summary !== event.description ? (
        <div className="mt-3 max-w-2xl">
          <p className="text-paper-dim">{event.summary}</p>
          {citation ? <WikipediaCredit article={citation.enwiki} /> : null}
        </div>
      ) : null}
      <p className="mt-3 font-mono text-sm text-muted">
        {coarse ? formatApproximate(event.date, event.datePrecision) : formatRange(event.date, event.endDate)}
      </p>
      {coarse ? (
        <p className="mt-2 max-w-2xl text-sm text-muted">
          The exact day has not been announced yet. This page will start ticking once the source publishes one.
        </p>
      ) : null}
      {previousDate ? (
        <p className="mt-2 max-w-2xl text-sm text-ember">
          Date changed: previously {formatLongDate(previousDate)}.
        </p>
      ) : null}

      {!isUser ? (
        <figure className="mt-10">
          {event.image ? (
            <>
              <EventImage
                image={event.image}
                alt={event.title}
                variant="hero"
                priority
                className="rounded-3xl border border-line"
              />
              <ImageCredit image={event.image} className="mt-2" />
            </>
          ) : (
            <FallbackCard
              slug={event.slug}
              title={event.title}
              category={event.category}
              variant="hero"
              className="rounded-3xl border border-line"
            />
          )}
        </figure>
      ) : null}

      <div className="ticket mt-10 rounded-3xl px-6 py-10 sm:px-10">
        <Countdown
          date={event.date}
          allDay={event.allDay}
          size="hero"
          initialDays={event.daysUntil}
          precision={event.datePrecision}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <CalendarButtons event={event} url={absoluteUrl(sharePath)} />
        <SaveButton id={event.id} />
        <ShareButton title={event.title} path={sharePath} />
      </div>

      {coarse ? null : (
        <EmbedStudio slug={shared ? slug : event.slug} title={event.title} origin={siteUrl()} />
      )}

      {event.seriesSlug ? (
        <p className="mt-8 text-sm text-paper-dim">
          Part of the{" "}
          <Link href={`/days-until/${event.seriesSlug}`} className="text-amber underline hover:text-paper">
            {event.seriesTitle ?? event.seriesSlug} series
          </Link>
          {" — every year, with the next date always on top."}
        </p>
      ) : null}

      <dl className="mt-10 grid gap-6 border-t border-line pt-8 text-sm sm:grid-cols-2">
        <div>
          <dt className="uppercase tracking-[0.16em] text-muted">Where</dt>
          <dd className="mt-2 flex flex-wrap items-center gap-2 text-paper-dim">
            {shownRegions.length === 0 ? (
              <span>Worldwide</span>
            ) : (
              shownRegions.slice(0, 24).map((code) =>
                COUNTRY_NAMES[code] ? (
                  <Chip key={code} href={`/country/${code.toLowerCase()}`}>
                    {regionLabel(code)}
                  </Chip>
                ) : (
                  <span key={code}>{regionLabel(code)}</span>
                ),
              )
            )}
            {shownRegions.length > 24 ? <span>+{shownRegions.length - 24}</span> : null}
            {event.location?.name ? <span>· {event.location.name}</span> : null}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.16em] text-muted">Tags</dt>
          <dd className="mt-2 flex flex-wrap gap-2">
            {event.tags.length === 0 ? (
              <span className="text-paper-dim">—</span>
            ) : (
              event.tags.map((tag) => (
                <Chip key={tag} href={isUser ? `/?q=${encodeURIComponent(tag)}` : `/tag/${encodeURIComponent(tag)}`}>
                  {tag}
                </Chip>
              ))
            )}
          </dd>
        </div>
      </dl>

      {!isUser ? <Provenance event={event} /> : null}

      {otherYears.length > 0 ? (
        <section className="mt-16">
          <h2 className="font-serif text-2xl text-paper">Other years</h2>
          <EventTable events={otherYears} showCategory={false} />
          {event.seriesSlug ? (
            <p className="mt-3 text-sm">
              <Link href={`/days-until/${event.seriesSlug}`} className="text-amber underline hover:text-paper">
                Every upcoming date
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

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

      <JsonLd data={eventJsonLd(event)} />
    </article>
  );
}
