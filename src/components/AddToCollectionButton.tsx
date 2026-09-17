"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { createAuthBrowserClient } from "@/lib/auth/browser";
import { safeNextPath } from "@/lib/auth/paths";
import {
  rememberPendingCollection,
  takePendingCollection,
  type CollectionSummary,
} from "@/lib/collections";
import {
  addEventToCollection,
  createEventCollection,
  listCollectionIdsForEvent,
  listOwnCollections,
  removeEventFromCollection,
} from "@/lib/collections-client";
import type { CountdownEvent } from "@/lib/types";
import { AuthDialog } from "./AuthDialog";
import { Icon } from "./Icon";

export function AddToCollectionButton({ event }: { event: CountdownEvent }) {
  const pathname = usePathname();
  const { ready, userId } = useCollection();
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!ready || !userId) return;
    const pendingSlug = takePendingCollection();
    if (!pendingSlug) return;
    if (pendingSlug !== event.slug) {
      rememberPendingCollection(pendingSlug);
      return;
    }
    void Promise.resolve().then(() => setOpen(true));
  }, [event.slug, ready, userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const client = createAuthBrowserClient();
    void Promise.all([listOwnCollections(client, userId), listCollectionIdsForEvent(client, event.slug, userId)])
      .then(([rows, ids]) => {
        if (cancelled) return;
        setCollections(rows);
        setSelected(ids);
        setError("");
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load your collections.");
      });
    return () => {
      cancelled = true;
    };
  }, [event.slug, userId]);

  async function toggle(collectionId: string, next: boolean) {
    if (!userId) return;
    setPending(true);
    setError("");
    try {
      const client = createAuthBrowserClient();
      if (next) await addEventToCollection(client, collectionId, event);
      else await removeEventFromCollection(client, collectionId, event.slug);
      setSelected((current) => (next ? [...current, collectionId] : current.filter((id) => id !== collectionId)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update that collection.");
    } finally {
      setPending(false);
    }
  }

  async function onCreate(formEvent: FormEvent) {
    formEvent.preventDefault();
    if (!userId) return;
    setPending(true);
    setError("");
    try {
      const client = createAuthBrowserClient();
      const created = await createEventCollection(client, {
        title,
        ownerId: userId,
        takenSlugs: collections.map((item) => item.slug),
      });
      await addEventToCollection(client, created.id, event);
      setCollections((current) => [created, ...current]);
      setSelected((current) => [...current, created.id]);
      setTitle("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create that collection.");
    } finally {
      setPending(false);
    }
  }

  if (!ready) {
    return (
      <span className="button-secondary pointer-events-none opacity-50">
        <Icon name="list" size={16} />
        Add to collection
      </span>
    );
  }

  if (!userId) {
    return (
      <>
        <button
          type="button"
          className="button-secondary"
          aria-haspopup="dialog"
          aria-expanded={authOpen}
          onClick={() => {
            rememberPendingCollection(event.slug);
            setAuthOpen(true);
          }}
        >
          <Icon name="list" size={16} />
          Add to collection
        </button>
        {authOpen ? (
          <AuthDialog
            next={safeNextPath(pathname)}
            heading="Sign in to add this."
            subtitle="Use Google or your email. Then you can add this countdown to a collection."
            onClose={() => setAuthOpen(false)}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="button-secondary"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="list" size={16} />
        {selected.length ? "In a collection" : "Add to collection"}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Add to a collection"
          className="menu absolute start-0 z-30 mt-2 w-[min(100vw-2rem,22rem)] !p-4"
        >
          <p className="text-xs text-muted">Public collections. Anyone can open them from your profile.</p>
          {collections.length ? (
            <ul className="mt-3 max-h-56 space-y-1 overflow-auto">
              {collections.map((collection) => {
                const checked = selected.includes(collection.id);
                return (
                  <li key={collection.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={pending}
                        onChange={(change) => void toggle(collection.id, change.target.checked)}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-paper">{collection.title}</span>
                        <span className="block text-xs text-muted">
                          {collection.itemCount} countdown{collection.itemCount === 1 ? "" : "s"}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-paper-dim">You do not have a collection yet.</p>
          )}
          <form onSubmit={(formEvent) => void onCreate(formEvent)} className="hairline mt-4 pt-4">
            <label className="block">
              <span className="field-label">New collection</span>
              <input
                className="field mt-2"
                value={title}
                maxLength={80}
                placeholder="Autumn nights"
                onChange={(change) => setTitle(change.target.value)}
              />
            </label>
            <button type="submit" className="button-primary mt-3 w-full" disabled={pending || !title.trim()}>
              Create and add
            </button>
          </form>
          <Link href="/collections" className="mt-3 inline-flex min-h-11 items-center text-xs text-amber hover:underline">
            Manage collections
          </Link>
          {error ? (
            <p role="alert" className="mt-3 text-xs leading-relaxed text-paper">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
