"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { loginHref, safeNextPath } from "@/lib/auth/paths";
import { encodeSharePayload } from "@/lib/user-events";
import { AddToCollectionButton } from "./AddToCollectionButton";
import { CalendarButtons } from "./CalendarButtons";
import { EventComments } from "./EventComments";
import { Countdown } from "./Countdown";
import { PersonalDateArtwork } from "./PersonalDateArtwork";
import { ShareButton } from "./ShareButton";
import { CATEGORY_LABELS } from "@/lib/labels";
import { absoluteUrl, siteUrl } from "@/lib/seo";
import { formatRange } from "@/lib/time";

const EmbedStudio = dynamic(() => import("./EmbedStudio").then((module) => module.EmbedStudio));

export function MineEvent({ slug }: { slug: string }) {
  const pathname = usePathname();
  const { ready, userId, mine } = useCollection();
  const [showEmbed, setShowEmbed] = useState(false);
  const event = mine.find((item) => item.slug === slug);
  const signInHref = loginHref(safeNextPath(pathname));

  if (!ready) return <div role="status" className="panel p-12 text-center text-sm text-muted">Opening your countdown…</div>;
  if (!userId) return (
    <div className="empty-state"><span className="pill">Personal countdown</span><h1 className="mt-5 text-3xl font-semibold tracking-tight text-paper sm:text-4xl">Sign in to open this countdown.</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-paper-dim">Personal countdowns live on your Until account. Sign in on this device, or ask for a shareable link if someone sent you this page.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href={signInHref} className="button-primary">Sign in</Link><Link href="/create" className="button-secondary">Create a countdown</Link></div></div>
  );
  if (!event) return (
    <div className="empty-state"><span className="pill">Personal countdown</span><h1 className="mt-5 text-3xl font-semibold tracking-tight text-paper sm:text-4xl">This countdown is not in your collection.</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-paper-dim">It may belong to another account, or it was removed. Create a new one, or open a share link if you were sent one.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/create" className="button-primary">Create a countdown</Link><Link href="/saved" className="button-secondary">Your collection</Link></div></div>
  );

  const payload = encodeSharePayload(event);
  const shareSlug = `share-${payload}`;
  const sharePath = `/event/${shareSlug}`;

  return (
    <article>
      <Link href="/saved" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-paper"><span aria-hidden="true">←</span>Your collection</Link>
      <div className="panel overflow-hidden">
        <PersonalDateArtwork date={event.date} />
        <div className="p-6 sm:p-9">
          <div className="flex flex-wrap items-center gap-3"><span className="pill">{CATEGORY_LABELS[event.category]}</span><span className="flex items-center gap-1.5 text-xs text-muted"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M10 17h4" /></svg>Saved to your account</span></div>
          <h1 className="mt-5 max-w-4xl break-words text-4xl font-semibold leading-[1.1] tracking-tight text-paper sm:text-5xl xl:text-6xl">{event.title}</h1>
          <p className="mt-4 text-base text-paper-dim">{formatRange(event.date, event.endDate)}</p>
          <div className="my-8 border-y border-line py-8 sm:py-10"><Countdown date={event.date} allDay={event.allDay} size="hero" /></div>
          {event.description && <p className="mb-7 max-w-2xl whitespace-pre-wrap break-words text-base leading-relaxed text-paper-dim">{event.description}</p>}
          <div className="flex flex-wrap items-start gap-3"><AddToCollectionButton event={event} />{payload && <ShareButton title={event.title} path={sharePath} />}<CalendarButtons event={event} url={payload ? absoluteUrl(sharePath) : undefined} /></div>
          <p className="mt-5 max-w-2xl text-xs leading-relaxed text-muted">{payload ? "A share link carries this countdown with it. Anyone with the link can read your title, date, category and note, even without an account." : "This note is too long for a share link. Your countdown is still saved to your account."}</p>
        </div>
      </div>
      <EventComments eventKey={event.slug} />
      {payload && <div className="mt-6"><button type="button" aria-expanded={showEmbed} aria-controls="personal-embed" onClick={() => setShowEmbed((value) => !value)} className="button-secondary">Embed this countdown <span aria-hidden="true">{showEmbed ? "−" : "+"}</span></button>{showEmbed && <div id="personal-embed" className="mt-4"><EmbedStudio slug={shareSlug} title={event.title} origin={siteUrl()} /></div>}</div>}
    </article>
  );
}
