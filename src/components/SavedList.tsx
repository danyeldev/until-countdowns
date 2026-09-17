"use client";

import { Link } from "@/i18n/navigation";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Countdown } from "@/components/Countdown";
import { SaveButton } from "@/components/SaveButton";
import { PersonalDateArtwork } from "@/components/PersonalDateArtwork";
import { EventImage } from "@/components/EventImage";
import { FallbackCard } from "@/components/FallbackCard";
import { CATEGORY_LABELS } from "@/lib/labels";
import { isCatalogEventId } from "@/lib/event-id";
import { eventInstant, formatApproximate, formatCompactDate, isCoarsePrecision } from "@/lib/time";
import { collectionEventPath, collectionPhase, type CollectionPhase } from "@/lib/personal-collection";
import type { CountdownEvent } from "@/lib/types";
import { useCollection } from "@/components/CollectionProvider";
import { useNow } from "@/lib/use-now";

type CollectionRow = { id: string; event?: CountdownEvent; personal: boolean };
const PHASES: { value: CollectionPhase; title: string; description: string }[] = [
  { value: "upcoming", title: "Next up", description: "A few things to look forward to." },
  { value: "changed", title: "Changed plans", description: "These dates have been postponed, cancelled, or retired." },
  { value: "unavailable", title: "Saved links", description: "Dates we could not find in the latest catalog." },
  { value: "past", title: "Past dates", description: "Still part of your story." },
];

const CollectionCard = memo(function CollectionCard({ row, loading, fetchError, onRemove }: { row: CollectionRow; loading: boolean; fetchError: string; onRemove: (id: string) => void }) {
  const { id, event, personal } = row;
  if (!event) return (
    <article className="flex min-h-64 flex-col justify-between rounded-2xl bg-surface p-6"><div><span className="pill">Saved link</span><h3 className="mt-6 text-xl font-semibold tracking-tight">{loading && isCatalogEventId(id) ? "Finding your countdown…" : "This date is unavailable"}</h3><p className="mt-3 text-sm leading-relaxed text-muted">{loading && isCatalogEventId(id) ? "Checking the latest catalog." : fetchError ? "Your saved link is safe. Try again when the catalog is available." : "It may have been removed from the catalog."}</p></div><div className="mt-6"><SaveButton id={id} /></div></article>
  );
  const href = collectionEventPath(event, personal);
  return (
    <article className="group flex min-w-0 flex-col">
      <div className="relative h-36 overflow-hidden rounded-2xl">
        <Link href={href} tabIndex={-1} aria-hidden="true" className="block h-full">
          {personal || event.source === "user" ? <PersonalDateArtwork date={event.date} compact /> : event.image ? <EventImage image={event.image} alt="" className="h-full" sizes="(max-width: 640px) 100vw, 33vw" /> : <FallbackCard slug={event.slug} title={event.title} category={event.category} className="h-full" />}
        </Link>
        <div className="absolute right-3 top-3">{personal ? <button type="button" onClick={() => onRemove(id)} aria-label={`Remove ${event.title}`} className="flex size-10 items-center justify-center rounded-full bg-ink/70 text-paper backdrop-blur-md hover:text-ember"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6" /></svg></button> : <SaveButton id={id} event={event} compact />}</div>
      </div>
      <div className="flex flex-1 flex-col pt-4">
        <p className="text-xs text-muted">{personal ? "Created by you" : CATEGORY_LABELS[event.category]}</p>
        <h3 className="mt-1.5 break-words text-[17px] font-semibold leading-snug tracking-[-.02em] text-paper"><Link href={href} className="hover:text-amber">{event.title}</Link></h3>
        <p className="mt-1 text-xs text-muted">{isCoarsePrecision(event.datePrecision) ? formatApproximate(event.date, event.datePrecision) : formatCompactDate(event.date, event.timezone)}</p>
        <div className="mt-4"><Countdown date={event.date} allDay={event.allDay} initialDays={event.daysUntil} precision={event.datePrecision} status={event.status} /></div>
        <Link href={href} className="mt-3 inline-flex min-h-10 items-center gap-1.5 self-start text-sm text-amber hover:text-paper">Open countdown <span aria-hidden="true">→</span></Link>
      </div>
    </article>
  );
});

export function SavedList() {
  const { ready, mine, savedIds, savedEvents: snapshots, removeMine, cacheSavedEvents } = useCollection();
  const now = useNow();
  const [fresh, setFresh] = useState<CountdownEvent[]>([]);
  const [resolvedKey, setResolvedKey] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [actionError, setActionError] = useState("");
  const [filter, setFilter] = useState<"all" | "saved" | "personal">("all");
  const [query, setQuery] = useState("");
  const [retry, setRetry] = useState(0);
  const requestKey = savedIds.filter(isCatalogEventId).join(",");

  useEffect(() => {
    if (!requestKey) return;
    const controller = new AbortController();
    const ids = requestKey.split(",");
    async function refresh() {
      try {
        const chunks: string[][] = [];
        for (let index = 0; index < ids.length; index += 25) chunks.push(ids.slice(index, index + 25));
        const pages = await Promise.all(chunks.map(async (chunk) => {
          const response = await fetch(`/api/events/saved?ids=${encodeURIComponent(chunk.join(","))}`, { signal: controller.signal });
          if (!response.ok) throw new Error("Your saved dates are here, but the latest catalog is unavailable. Try again in a moment.");
          const data: unknown = await response.json();
          if (!data || typeof data !== "object" || !Array.isArray((data as { items?: unknown }).items)) throw new Error("Could not refresh your saved dates.");
          return (data as { items: CountdownEvent[] }).items;
        }));
        if (controller.signal.aborted) return;
        const items = pages.flat();
        setFresh(items);
        setFetchError("");
        setResolvedKey(requestKey);
        void cacheSavedEvents(items);
      } catch (error) {
        if (controller.signal.aborted) return;
        setResolvedKey(requestKey);
        setFetchError(error instanceof Error ? error.message : "Could not refresh your saved dates.");
      }
    }
    void refresh();
    return () => controller.abort();
  }, [cacheSavedEvents, requestKey, retry]);

  const personalIds = useMemo(() => new Set(mine.map((event) => event.id)), [mine]);
  const records = useMemo(() => new Map([...snapshots, ...fresh].map((event) => [event.id, event])), [snapshots, fresh]);
  const savedOnly = useMemo(() => savedIds.filter((id) => !personalIds.has(id)), [savedIds, personalIds]);
  const count = mine.length + savedOnly.length;
  const loading = Boolean(requestKey && resolvedKey !== requestKey);
  const minute = now === null ? 0 : Math.floor(now / 60_000);
  const grouped = useMemo(() => {
    const result: Record<CollectionPhase, CollectionRow[]> = { upcoming: [], changed: [], past: [], unavailable: [] };
    const rows: CollectionRow[] = [
      ...(filter !== "saved" ? mine.map((event) => ({ id: event.id, event, personal: true })) : []),
      ...(filter !== "personal" ? savedOnly.map((id) => ({ id, event: records.get(id), personal: false })) : []),
    ];
    const needle = query.trim().toLocaleLowerCase();
    for (const row of rows) {
      if (needle && !`${row.event?.title ?? row.id} ${row.event?.description ?? ""}`.toLocaleLowerCase().includes(needle)) continue;
      result[collectionPhase(row.event, minute * 60_000)].push(row);
    }
    for (const phase of PHASES) result[phase.value].sort((a, b) => {
      const first = a.event ? eventInstant(a.event.date, a.event.allDay).getTime() : 0;
      const second = b.event ? eventInstant(b.event.date, b.event.allDay).getTime() : 0;
      const order = first - second || a.id.localeCompare(b.id);
      return phase.value === "past" ? -order : order;
    });
    return result;
  }, [mine, savedOnly, records, filter, query, minute]);
  const visibleCount = Object.values(grouped).reduce((total, rows) => total + rows.length, 0);

  const removePersonal = useCallback((id: string) => {
    void removeMine(id)
      .then(() => setActionError(""))
      .catch((error) => setActionError(error instanceof Error ? error.message : "Could not remove this countdown."));
  }, [removeMine]);

  if (!ready || now === null) return <div role="status" className="empty-state text-sm">Opening your collection…</div>;

  return (
    <div>
      {actionError && <p role="alert" className="notice mb-5">{actionError}</p>}
      {count === 0 ? (
        <div>
          <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-amber/20 via-ink-2 to-ink"><svg aria-hidden="true" className="text-amber" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M6 3h12v18l-6-4-6 4V3Z" /><path d="M9 8h6m-3-3v6" /></svg></div>
          <div className="px-6 py-10 text-center sm:py-14"><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Start with something you love.</h2><p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">Save a date that catches your eye, or create a countdown for a moment of your own. They stay with your account.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/" className="button-primary">Explore dates <span aria-hidden="true">↗</span></Link><Link href="/create" className="button-secondary">Create a countdown</Link></div></div>
        </div>
      ) : <>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex max-w-full gap-1 overflow-x-auto" role="group" aria-label="Filter your collection">{([ ["all", "All", count], ["saved", "Saved", savedOnly.length], ["personal", "Created", mine.length] ] as const).map(([value, label, total]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className="chip" aria-current={filter === value ? "true" : undefined}>{label}<span className={`text-xs tabular-nums ${filter === value ? "text-ink/60" : "text-muted"}`}>{total}</span></button>)}</div>
          <label className="field flex min-w-0 basis-full items-center gap-2 !min-h-11 !py-0 sm:max-w-64 sm:flex-1 sm:basis-auto"><svg aria-hidden="true" className="shrink-0 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg><span className="sr-only">Search your collection</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find in collection" className="min-h-11 min-w-0 w-full bg-transparent text-sm tracking-normal text-paper outline-none" /></label>
        </div>
        {fetchError && requestKey && <div role="status" className="notice mb-6 flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-sm leading-relaxed text-paper-dim">{fetchError}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="button-secondary">Try again</button></div>}
        {visibleCount === 0 && <div className="empty-state"><h2 className="text-xl font-semibold">{query ? "No matching dates" : filter === "personal" ? "Your own moments start here." : "Nothing saved here yet."}</h2><p className="mt-3 text-sm text-muted">{query ? "Try a different title or clear your search." : "Explore the catalog or create something just for you."}</p><div className="mt-6 flex flex-wrap justify-center gap-3">{query ? <button type="button" onClick={() => setQuery("")} className="button-secondary">Clear search</button> : <Link href={filter === "personal" ? "/create" : "/"} className="button-primary">{filter === "personal" ? "Create countdown" : "Explore dates"}</Link>}</div></div>}
        <div className="space-y-14">{PHASES.map((phase) => {
          const rows = grouped[phase.value];
          if (!rows.length) return null;
          const cards = <div className="mt-5 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <CollectionCard key={row.id} row={row} loading={loading} fetchError={fetchError} onRemove={removePersonal} />)}</div>;
          return phase.value === "past" ? <details key={phase.value} className="hairline pt-6" open={Boolean(query)}><summary className="cursor-pointer py-2 text-base font-medium text-paper-dim">Past dates <span className="ml-2 text-sm tabular-nums text-muted">{rows.length}</span></summary><p className="mt-1 text-sm text-muted">{phase.description}</p>{cards}</details> : <section key={phase.value} aria-label={phase.title}><div className="flex items-baseline gap-3"><h2 className="section-heading">{phase.title}</h2><span className="text-sm tabular-nums text-muted">{rows.length}</span></div><p className="mt-1 text-sm text-muted">{phase.description}</p>{cards}</section>;
        })}</div>
        <p className="mt-8 text-xs leading-relaxed text-muted">Saved to your account. {loading ? "Checking saved dates for updates…" : "Share a countdown so anyone can open it without signing in."}</p>
      </>}
    </div>
  );
}
