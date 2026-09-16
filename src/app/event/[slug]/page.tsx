import { canAddToCalendar } from "@/lib/calendar";
import { prerenderLimit } from "@/lib/prerender";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CalendarButtons } from "@/components/CalendarButtons";
import { DetailHero } from "@/components/DetailHero";
import { YearTimeline } from "@/components/YearTimeline";
import { Icon } from "@/components/Icon";
import { EmbedStudio } from "@/components/EmbedStudio";
import { EventCard } from "@/components/EventCard";
import { IntentAnswer } from "@/components/IntentAnswer";
import { EventComments } from "@/components/EventComments";
import { JsonLd } from "@/components/JsonLd";
import { MineEvent } from "@/components/MineEvent";
import { AddToCollectionButton } from "@/components/AddToCollectionButton";
import { ReportEventButton } from "@/components/ReportEventButton";
import { HypeMeter } from "@/components/HypeMeter";
import { SaveButton } from "@/components/SaveButton";
import { ShareButton } from "@/components/ShareButton";
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
import { formatCompactDate, isCoarsePrecision } from "@/lib/time";
import type { CountdownEvent } from "@/lib/types";
import { hypeEventKey } from "@/lib/hype";
import { decodeSharePayload } from "@/lib/user-events";

export const revalidate = 3600;

const OTHER_YEARS = 6;

/**
 * Prerenders the most popular upcoming slugs. An empty array is fine under ISR
 * (every path then renders on first visit; `dynamicParams` stays true), so a build with an
 * empty or unreachable database prerenders nothing rather than a set of cached 404s.
 */
export async function generateStaticParams() {
  const limit = prerenderLimit(500);
  if (!limit) return [];
  const slugs = await topSlugs(limit);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/event/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (slug.startsWith("mine-"))
    return { title: "Your countdown", robots: { index: false, follow: false } };
  if (slug.startsWith("share-")) {
    const payload = slug.slice("share-".length);
    const shared = decodeSharePayload(payload);
    if (!shared)
      return {
        title: "Shared countdown",
        robots: { index: false, follow: false },
      };
    return buildMetadata({
      title: `${shared.title} — ${formatLongDate(shared.date)} countdown`,
      description: `${shared.title} is on ${formatLongDate(shared.date)}. A countdown someone made on Until.`,
      canonical: `/event/${slug}`,
      ogPath: `/og/share/${encodeURIComponent(payload)}`,
      noindex: true,
    });
  }
  const event = await getEvent(slug);
  if (!event)
    return { title: "Countdown", robots: { index: false, follow: true } };
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
      ...(canAddToCalendar(event)
        ? { "text/calendar": absoluteUrl(`/api/ics/${event.slug}`) }
        : {}),
      // Advertised only where there is a clock to embed: a coarse date has none, and a consumer
      // that follows the link into a 404 shows the reader an embed error rather than a plain link.
      ...(!canAddToCalendar(event)
        ? {}
        : {
            "application/json+oembed": oembedDiscoveryUrl(
              `/event/${event.slug}`,
            ),
          }),
    },
  };
  return metadata;
}

function Provenance({ event }: { event: CountdownEvent }) {
  const label = event.sourceLabel || sourceLabel(event.source);
  const verified = event.lastVerifiedAt
    ? formatCompactDate(event.lastVerifiedAt.slice(0, 10))
    : null;
  return (
    <section className="panel rounded-2xl border border-line bg-ink-2 p-5 sm:p-6">
      <div className="flex items-center gap-2 text-muted">
        <Icon name="globe" size={17} />
        <h2 className="text-sm font-medium text-paper">Date source</h2>
      </div>
      <p className="mt-4 text-base font-medium text-paper">
        {event.sourceUrl ? (
          <a
            href={event.sourceUrl}
            className="inline-flex min-h-11 items-center gap-2 text-amber hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {label}
            <Icon name="arrow" size={16} />
          </a>
        ) : (
          label
        )}
      </p>
      {verified ? (
        <p className="mt-1 text-sm text-muted">Last verified {verified}</p>
      ) : null}
      <Link
        href="/attributions"
        className="mt-4 inline-flex min-h-11 items-center text-xs text-paper-dim underline decoration-line underline-offset-4 hover:text-paper"
      >
        Sources and attributions
      </Link>
      <p className="mt-5 text-xs leading-relaxed text-muted">
        This is a public listing. If the date or details look wrong, tell us.
      </p>
      <ReportEventButton eventId={event.id} eventKey={event.slug} title={event.title} />
    </section>
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
      <a
        href={href}
        className="underline hover:text-paper"
        target="_blank"
        rel="noreferrer"
      >
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
    <Link
      href={href}
      className="inline-flex min-h-11 items-center rounded-xl border border-line bg-ink px-3 text-xs text-paper-dim hover:border-amber/40 hover:text-amber"
    >
      {children}
    </Link>
  );
}

export default async function EventPage({
  params,
}: PageProps<"/event/[slug]">) {
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
    event.seriesSlug
      ? seriesOccurrences(event.seriesSlug, OTHER_YEARS + 2)
      : [],
    isUser || !event.summary ? null : summaryCitation(event.slug),
  ]);
  const otherYears = siblings
    .filter((o) => o.slug !== event.slug)
    .slice(0, OTHER_YEARS);
  // A shared personal countdown is reached at the payload URL it arrived on — the `mine-…` slug
  // the payload decodes to only resolves for the signed-in owner, so it is not shareable.
  const shared = slug.startsWith("share-");
  const sharePath = shared ? `/event/${slug}` : `/event/${event.slug}`;
  const hypeKey = hypeEventKey(event);
  const coarse = isCoarsePrecision(event.datePrecision);
  const shownRegions = event.regions.filter((r) => r !== "GLOBAL");
  const previousDate = event.dateHistory?.at(-1)?.date;

  const crumbs: Crumb[] = [{ name: "Home", path: "/" }];
  if (!isUser)
    crumbs.push({
      name: CATEGORY_LABELS[event.category],
      path: `/category/${event.category}`,
    });
  if (event.seriesSlug && event.seriesTitle)
    crumbs.push({
      name: event.seriesTitle,
      path: `/days-until/${event.seriesSlug}`,
    });
  crumbs.push({ name: truncate(event.title, 80), path: sharePath });

  return (
    <article className="pb-4">
      <Breadcrumbs items={crumbs} />
      <DetailHero
        title={event.title}
        kicker={
          isUser ? (
            <span>Shared countdown</span>
          ) : (
            <Link
              href={`/category/${event.category}`}
              className="rounded-md hover:text-paper"
            >
              {CATEGORY_LABELS[event.category]}
            </Link>
          )
        }
        date={event.date}
        endDate={event.endDate}
        allDay={event.allDay}
        timezone={event.timezone}
        initialDays={event.daysUntil}
        precision={event.datePrecision}
        status={event.status}
        image={isUser ? undefined : event.image}
        hype={hypeKey ? <HypeMeter eventKey={hypeKey} /> : null}
        actions={
          <>
            <SaveButton id={event.id} event={event} />
            {!isUser ? <AddToCollectionButton event={event} /> : null}
            <CalendarButtons event={event} url={absoluteUrl(sharePath)} hypeKey={hypeKey} />
            <ShareButton title={event.title} path={sharePath} hypeKey={hypeKey} />
          </>
        }
      />

      {previousDate ? (
        <p className="mt-4 rounded-xl border border-ember/30 bg-ember/5 px-4 py-3 text-sm text-ember">
          Schedule updated. Previously{" "}
          {formatLongDate(previousDate, event.timezone)}.
        </p>
      ) : null}

      {event.seriesSlug ? (
        <section className="mt-8" aria-labelledby="other-dates-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="other-dates-heading" className="section-heading">
                Choose a year
              </h2>
              <p className="mt-1 text-sm text-muted">
                More dates for {event.seriesTitle ?? event.title}.
              </p>
            </div>
            <Link
              href={`/days-until/${event.seriesSlug}`}
              className="button-secondary gap-2"
            >
              All dates <Icon name="arrow" size={16} />
            </Link>
          </div>
          {otherYears.length ? (
            <YearTimeline
              events={[event, ...otherYears].sort((a, b) =>
                a.date.localeCompare(b.date),
              )}
              currentSlug={event.slug}
            />
          ) : null}
        </section>
      ) : null}

      <div className="mt-8 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.48fr)]">
        <section className="panel min-w-0 rounded-2xl border border-line bg-ink-2 p-5 sm:p-6">
          <h2 className="section-heading">About this moment</h2>
          <IntentAnswer
            className="mt-4"
            title={event.title}
            date={event.date}
            days={event.daysUntil}
            precision={event.datePrecision}
            status={event.status}
            timezone={event.timezone}
          />
          {event.description ? (
            <p className="mt-4 text-sm leading-relaxed text-paper-dim">
              {event.description}
            </p>
          ) : null}
          {event.summary && event.summary !== event.description ? (
            <div className="mt-4 text-sm leading-relaxed text-paper-dim">
              <p>{event.summary}</p>
              {citation ? <WikipediaCredit article={citation.enwiki} /> : null}
            </div>
          ) : null}
          {coarse ? (
            <p className="mt-4 rounded-xl border border-line bg-ink px-4 py-3 text-sm text-muted">
              The source has announced a date range. An exact day has not been
              confirmed.
            </p>
          ) : null}
          <dl className="mt-6 space-y-5 border-t border-line pt-5 text-sm">
            <div>
              <dt className="font-medium text-paper">Where</dt>
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
                {shownRegions.length > 24 ? (
                  <span>+{shownRegions.length - 24}</span>
                ) : null}
                {event.location?.name ? (
                  <span>{event.location.name}</span>
                ) : null}
              </dd>
            </div>
            {event.tags.length ? (
              <div>
                <dt className="font-medium text-paper">
                  Explore related topics
                </dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {event.tags.map((tag) => (
                    <Chip
                      key={tag}
                      href={
                        isUser
                          ? `/?q=${encodeURIComponent(tag)}`
                          : `/tag/${encodeURIComponent(tag)}`
                      }
                    >
                      {tag}
                    </Chip>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
        {!isUser ? (
          <Provenance event={event} />
        ) : (
          <aside className="panel rounded-2xl border border-line bg-ink-2 p-5 sm:p-6">
            <Icon name="bookmark" className="text-amber" />
            <h2 className="mt-3 text-base font-medium text-paper">
              Keep this countdown
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Save it to your collection, or share the link with someone else.
            </p>
            <Link href="/saved" className="button-secondary mt-5">
              Open collection
            </Link>
          </aside>
        )}
      </div>

      <EventComments eventKey={event.slug} />

      {canAddToCalendar(event) ? (
        <EmbedStudio
          slug={shared ? slug : event.slug}
          title={event.title}
          origin={siteUrl()}
        />
      ) : null}

      {related.length > 0 ? (
        <section className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-heading">Also on the horizon</h2>
            <Link
              href={`/category/${event.category}`}
              className="inline-flex min-h-11 items-center gap-2 text-sm text-amber hover:text-paper"
            >
              Explore more <Icon name="arrow" size={16} />
            </Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {related.map((item) => (
              <EventCard key={item.id} event={item} />
            ))}
          </div>
        </section>
      ) : null}
      <JsonLd data={eventJsonLd(event)} />
    </article>
  );
}
