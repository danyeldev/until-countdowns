import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { Fragment } from "react";
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
import type { Localized } from "@/lib/i18n/bind";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/config";
import { hasEntityName } from "@/lib/i18n/content";
import { regionLabel } from "@/lib/i18n/regions";
import { i18n, localePage } from "@/lib/i18n/server";
import { eventJsonLd, type Crumb } from "@/lib/jsonld";
import { sourceLabel } from "@/lib/labels";
import { COUNTRY_NAMES } from "@/lib/regions";
import {
  absoluteUrl,
  buildMetadata,
  displayTitle,
  eventDescription,
  eventTitle,
  formatApproximate,
  formatLongDate,
  oembedDiscoveryUrl,
  ogDatedPath,
  siteUrl,
  todayUtc,
  truncate,
} from "@/lib/seo";
import { isCoarsePrecision } from "@/lib/time";
import type { CountdownEvent } from "@/lib/types";
import { decodeSharePayload } from "@/lib/user-events";

export const revalidate = 3600;

const OTHER_YEARS = 6;

/** How many of the most popular slugs are prerendered, in English and in everything else. */
const PRERENDER = { en: 500, other: 50 };

/**
 * Prerenders the most popular upcoming slugs. An empty array is fine under ISR
 * (every path then renders on first visit; `dynamicParams` stays true), so a build with an
 * empty or unreachable database prerenders nothing rather than a set of cached 404s.
 *
 * The list is shorter outside English because every entry here is built once per locale, and a
 * dated occurrence page is only indexed in a language that has a name for the entity (see
 * `generateMetadata`); the rest of the tail is better rendered on the first visit it ever gets.
 */
export async function generateStaticParams() {
  const locale = await localeParam();
  const slugs = await topSlugs(locale === DEFAULT_LOCALE ? PRERENDER.en : PRERENDER.other);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/event/[slug]">): Promise<Metadata> {
  const L = await i18n();
  const { slug } = await params;
  if (slug.startsWith("mine-")) return { title: L.m.seo.event.mineTitle, robots: { index: false, follow: false } };
  if (slug.startsWith("share-")) {
    const payload = slug.slice("share-".length);
    const shared = decodeSharePayload(payload);
    if (!shared) return { title: L.m.seo.event.sharedTitle, robots: { index: false, follow: false } };
    const date = formatLongDate(L, shared.date);
    return buildMetadata({
      locale: L.locale,
      title: L.t(L.m.seo.event.sharedMetaTitle, { title: shared.title, date }),
      description: L.t(L.m.seo.event.sharedMetaDescription, { title: shared.title, date }),
      canonical: `/event/${slug}`,
      ogPath: `/og/share/${encodeURIComponent(payload)}`,
      noindex: true,
    });
  }
  const event = await getEvent(slug);
  if (!event) return { title: L.m.seo.event.fallbackTitle, robots: { index: false, follow: true } };
  /**
   * The locales this occurrence is a real page in: English, plus every locale with a curated name
   * for the entity. 40,000 occurrence pages times fifteen languages is a crawl budget the catalog
   * cannot pay, and it should not want to — a page that says "Navidad" is a Spanish page, while one
   * that says "Eclipse Temurin 26 end of life" is an English page served from a Spanish URL.
   */
  const cluster = LOCALES.filter((l) => l === DEFAULT_LOCALE || hasEntityName(l, event.title, event.slug));
  const metadata = buildMetadata({
    locale: L.locale,
    title: eventTitle(L, event),
    description: eventDescription(L, event),
    canonical: `/event/${event.slug}`,
    ogPath: ogDatedPath("event", event.slug, todayUtc()),
    // Series members point at the evergreen series page; incomplete rows stay out of the index,
    // and so does every locale outside the cluster.
    noindex: event.indexable === false || Boolean(event.seriesSlug) || !cluster.includes(L.locale),
    translatedIn: cluster,
  });
  metadata.alternates = {
    ...metadata.alternates,
    types: {
      "text/calendar": absoluteUrl(`/api/ics/${event.slug}`),
      // Advertised only where there is a clock to embed: a coarse date has none, and a consumer
      // that follows the link into a 404 shows the reader an embed error rather than a plain link.
      ...(isCoarsePrecision(event.datePrecision)
        ? {}
        : { "application/json+oembed": oembedDiscoveryUrl(L.locale, `/event/${event.slug}`) }),
    },
  };
  return metadata;
}

/**
 * Fills a message whose placeholders are elements rather than words, so a sentence with a link
 * inside it stays one translatable string — and the translator, not the JSX, decides where in the
 * sentence the link falls.
 */
function fillNodes(template: string, parts: Record<string, React.ReactNode>): React.ReactNode[] {
  return template.split(/(\{\w+\})/g).map((chunk, i) => {
    const key = /^\{(\w+)\}$/.exec(chunk)?.[1];
    return key && key in parts ? <Fragment key={i}>{parts[key]}</Fragment> : chunk;
  });
}

function Provenance({ L, event }: { L: Localized; event: CountdownEvent }) {
  const label = event.sourceLabel || sourceLabel(event.source);
  const verified = event.lastVerifiedAt ? L.fmt.compactDate(event.lastVerifiedAt.slice(0, 10)) : null;
  return (
    <p className="mt-8 text-xs text-muted">
      {L.m.event.provenance.source}{" "}
      {event.sourceUrl ? (
        <a href={event.sourceUrl} className="underline hover:text-paper" target="_blank" rel="noreferrer">
          {label}
        </a>
      ) : (
        label
      )}
      {verified ? ` · ${L.t(L.m.event.provenance.lastVerified, { date: verified })}` : ""}
      {" · "}
      <Link href={L.href("/attributions")} className="underline hover:text-paper">
        {L.m.common.footer.attributions}
      </Link>
    </p>
  );
}

/**
 * Wikipedia prose is CC BY-SA 4.0: whenever the enrichment queue filled `summary` from an article
 * (`external_ids.summary_source === 'wikipedia'`), the page has to say so and link the article.
 */
function WikipediaCredit({ L, article }: { L: Localized; article: string }) {
  const href = `https://en.wikipedia.org/wiki/${encodeURIComponent(article.replace(/ /g, "_"))}`;
  return (
    <p className="mt-2 text-xs text-muted">
      {fillNodes(L.m.event.provenance.summary, {
        source: (
          <a href={href} className="underline hover:text-paper" target="_blank" rel="noreferrer">
            Wikipedia
          </a>
        ),
        license: (
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            className="underline hover:text-paper"
            target="_blank"
            rel="noreferrer license"
          >
            CC BY-SA 4.0
          </a>
        ),
      })}
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

export default async function EventPage({ params }: PageProps<"/[locale]/event/[slug]">) {
  const L = await localePage();
  const { slug } = await params;

  if (slug.startsWith("mine-")) {
    return (
      <MineEvent
        slug={slug}
        locale={L.locale}
        m={L.m.event}
        actions={L.m.common.actions}
        labels={L.m.common.labels}
        categories={L.m.categories.labels}
        countdownLabels={L.m.embed.countdown}
        studioLabels={L.m.embed.studio}
      />
    );
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
      if (current) permanentRedirect(L.href(`/event/${current}`));
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
  // App-internal path of this page. The crumbs and the JSON-LD take it as it is and localize it
  // themselves; anything a reader copies takes the locale's own URL.
  const canonical = shared ? `/event/${slug}` : `/event/${event.slug}`;
  const sharePath = L.href(canonical);
  const coarse = isCoarsePrecision(event.datePrecision);
  const shownRegions = event.regions.filter((r) => r !== "GLOBAL");
  const previousDate = event.dateHistory?.at(-1)?.date;
  const title = displayTitle(L, event);
  const seriesName = event.seriesTitle
    ? displayTitle(L, { title: event.seriesTitle, slug: event.seriesSlug })
    : null;
  // A run of days is two compact dates; everything else — one day, or a whole month or quarter —
  // is the one date the row has, said as precisely as the row allows.
  const whenLine =
    !coarse && event.endDate && event.endDate !== event.date
      ? L.t(L.m.event.dateRange, {
          start: L.fmt.compactDate(event.date),
          end: L.fmt.compactDate(event.endDate),
        })
      : formatApproximate(L, event.date, event.datePrecision);

  const crumbs: Crumb[] = [{ name: L.m.common.breadcrumb.home, path: "/" }];
  if (!isUser) crumbs.push({ name: L.m.categories.labels[event.category], path: `/category/${event.category}` });
  if (event.seriesSlug && seriesName) crumbs.push({ name: seriesName, path: `/days-until/${event.seriesSlug}` });
  crumbs.push({ name: truncate(title, 80), path: canonical });

  return (
    <article>
      <Breadcrumbs items={crumbs} />
      <p className="mt-6 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-amber">
        <Link href={L.href(`/category/${event.category}`)} className="hover:text-paper">
          {L.m.categories.labels[event.category]}
        </Link>
        <StatusBadge status={event.status} />
      </p>
      <h1 className="mt-3 font-serif text-4xl leading-tight text-paper sm:text-6xl">{title}</h1>
      <IntentAnswer
        className="mt-5 max-w-2xl"
        title={title}
        date={event.date}
        days={event.daysUntil}
        precision={event.datePrecision}
        status={event.status}
        timezone={event.timezone}
      />
      <p className="mt-4 max-w-2xl text-lg text-paper-dim">{event.description}</p>
      {event.summary && event.summary !== event.description ? (
        <div className="mt-3 max-w-2xl">
          <p className="text-paper-dim">{event.summary}</p>
          {citation ? <WikipediaCredit L={L} article={citation.enwiki} /> : null}
        </div>
      ) : null}
      <p className="mt-3 font-mono text-sm text-muted">{whenLine}</p>
      {coarse ? <p className="mt-2 max-w-2xl text-sm text-muted">{L.m.event.coarseNote}</p> : null}
      {previousDate ? (
        <p className="mt-2 max-w-2xl text-sm text-ember">
          {L.t(L.m.event.dateChanged, { date: formatLongDate(L, previousDate) })}
        </p>
      ) : null}

      {!isUser ? (
        <figure className="mt-10">
          {event.image ? (
            <>
              <EventImage
                image={event.image}
                alt={title}
                variant="hero"
                priority
                className="rounded-3xl border border-line"
              />
              <ImageCredit image={event.image} className="mt-2" />
            </>
          ) : (
            <FallbackCard
              slug={event.slug}
              title={title}
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
          locale={L.locale}
          labels={L.m.embed.countdown}
          approximate={formatApproximate(L, event.date, event.datePrecision)}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <CalendarButtons event={event} url={absoluteUrl(sharePath)} labels={L.m.common.actions} />
        <SaveButton id={event.id} labels={L.m.common.actions} />
        <ShareButton title={title} path={sharePath} labels={L.m.common.actions} />
      </div>

      {coarse ? null : <EmbedStudio slug={shared ? slug : event.slug} title={title} origin={siteUrl()} labels={L.m.embed.studio} actions={L.m.common.actions} />}

      {event.seriesSlug ? (
        <p className="mt-8 text-sm text-paper-dim">
          {fillNodes(L.m.event.partOfSeries, {
            series: (
              <Link
                href={L.href(`/days-until/${event.seriesSlug}`)}
                className="text-amber underline hover:text-paper"
              >
                {seriesName ?? event.seriesSlug}
              </Link>
            ),
          })}
        </p>
      ) : null}

      <dl className="mt-10 grid gap-6 border-t border-line pt-8 text-sm sm:grid-cols-2">
        <div>
          <dt className="uppercase tracking-[0.16em] text-muted">{L.m.event.fields.where}</dt>
          <dd className="mt-2 flex flex-wrap items-center gap-2 text-paper-dim">
            {shownRegions.length === 0 ? (
              <span>{L.m.common.labels.worldwide}</span>
            ) : (
              shownRegions.slice(0, 24).map((code) =>
                COUNTRY_NAMES[code] ? (
                  <Chip key={code} href={L.href(`/country/${code.toLowerCase()}`)}>
                    {regionLabel(L, code)}
                  </Chip>
                ) : (
                  <span key={code}>{regionLabel(L, code)}</span>
                ),
              )
            )}
            {shownRegions.length > 24 ? <span>+{L.fmt.number(shownRegions.length - 24)}</span> : null}
            {event.location?.name ? <span>· {event.location.name}</span> : null}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.16em] text-muted">{L.m.event.fields.tags}</dt>
          <dd className="mt-2 flex flex-wrap gap-2">
            {event.tags.length === 0 ? (
              <span className="text-paper-dim">—</span>
            ) : (
              event.tags.map((tag) => (
                <Chip
                  key={tag}
                  href={L.href(isUser ? `/?q=${encodeURIComponent(tag)}` : `/tag/${encodeURIComponent(tag)}`)}
                >
                  {tag}
                </Chip>
              ))
            )}
          </dd>
        </div>
      </dl>

      {!isUser ? <Provenance L={L} event={event} /> : null}

      {otherYears.length > 0 ? (
        <section className="mt-16">
          <h2 className="font-serif text-2xl text-paper">{L.m.event.otherYears}</h2>
          <EventTable events={otherYears} showCategory={false} />
          {event.seriesSlug ? (
            <p className="mt-3 text-sm">
              <Link
                href={L.href(`/days-until/${event.seriesSlug}`)}
                className="text-amber underline hover:text-paper"
              >
                {L.m.event.everyUpcomingDate}
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="font-serif text-2xl text-paper">{L.m.event.alsoComing}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <EventCard key={item.id} event={item} />
            ))}
          </div>
        </section>
      )}

      <JsonLd data={eventJsonLd(L, event)} />
    </article>
  );
}
