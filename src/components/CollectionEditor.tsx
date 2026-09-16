"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { createAuthBrowserClient } from "@/lib/auth/browser";
import {
  COLLECTION_DESCRIPTION_MAX,
  COLLECTION_IMAGE_TYPES,
  COLLECTION_IMAGES_MAX,
  COLLECTION_TITLE_MAX,
  collectionHref,
  collectionImageUrl,
  collectionItemHref,
  type CollectionDetail,
} from "@/lib/collections";
import {
  createEventCollection,
  deleteCollectionImage,
  deleteEventCollection,
  removeEventFromCollection,
  updateEventCollection,
  uploadCollectionImages,
} from "@/lib/collections-client";

export function CollectionEditor({ initial }: { initial?: CollectionDetail }) {
  const router = useRouter();
  const { userId } = useCollection();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [images, setImages] = useState(initial?.images ?? []);
  const [items, setItems] = useState(initial?.items ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!userId) {
      setError("Sign in to save a collection.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const client = createAuthBrowserClient();
      if (initial) {
        await updateEventCollection(client, initial.id, {
          title,
          description,
          currentSlug: initial.slug,
        });
        if (files.length) {
          await uploadCollectionImages(client, { ...initial, images }, files);
        }
        router.push(collectionHref(initial.owner.handle, initial.slug));
        router.refresh();
        return;
      }
      const created = await createEventCollection(client, { title, description, ownerId: userId });
      if (files.length) {
        await uploadCollectionImages(client, { ...created, images: [] }, files);
      }
      router.push(`/collections/${created.id}/edit`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save that collection.");
    } finally {
      setPending(false);
    }
  }

  async function onRemoveImage(id: string) {
    const image = images.find((item) => item.id === id);
    if (!image) return;
    setPending(true);
    try {
      await deleteCollectionImage(createAuthBrowserClient(), image);
      setImages((current) => current.filter((item) => item.id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove that image.");
    } finally {
      setPending(false);
    }
  }

  async function onRemoveItem(eventKey: string) {
    if (!initial) return;
    setPending(true);
    try {
      await removeEventFromCollection(createAuthBrowserClient(), initial.id, eventKey);
      setItems((current) => current.filter((item) => item.slug !== eventKey && item.id !== eventKey));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove that countdown.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!initial) return;
    if (!window.confirm("Delete this public collection? The countdowns themselves stay where they are.")) return;
    setPending(true);
    try {
      await deleteEventCollection(createAuthBrowserClient(), { ...initial, images });
      router.push("/collections");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete that collection.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="panel p-5 sm:p-7">
        <label className="block">
          <span className="field-label">Title</span>
          <input
            className="field mt-2"
            value={title}
            maxLength={COLLECTION_TITLE_MAX}
            required
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="mt-5 block">
          <span className="field-label">Description</span>
          <textarea
            className="field mt-2 min-h-28"
            value={description}
            maxLength={COLLECTION_DESCRIPTION_MAX}
            onChange={(event) => setDescription(event.target.value)}
          />
          <span className="mt-2 block text-xs text-muted">
            {description.length}/{COLLECTION_DESCRIPTION_MAX}
          </span>
        </label>
      </div>

      <div className="panel p-5 sm:p-7">
        <h2 className="section-heading">Images</h2>
        <p className="mt-2 text-sm text-paper-dim">
          Add up to {COLLECTION_IMAGES_MAX} photos. The first one becomes the cover.
        </p>
        {images.length ? (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image) => (
              <li key={image.id} className="overflow-hidden rounded-2xl border border-line">
                <div className="relative aspect-4/3">
                  <Image src={collectionImageUrl(image.path)} alt="" fill unoptimized className="object-cover" />
                </div>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-xs text-paper-dim hover:text-paper"
                  disabled={pending}
                  onClick={() => void onRemoveImage(image.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {images.length + files.length < COLLECTION_IMAGES_MAX ? (
          <label className="mt-5 block">
            <span className="field-label">Add photos</span>
            <input
              className="mt-2 block w-full text-sm text-paper-dim file:mr-3 file:rounded-xl file:border-0 file:bg-amber/15 file:px-3 file:py-2 file:text-xs file:text-amber"
              type="file"
              accept={COLLECTION_IMAGE_TYPES.join(",")}
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, COLLECTION_IMAGES_MAX - images.length))}
            />
          </label>
        ) : null}
        {files.length ? <p className="mt-3 text-xs text-muted">{files.length} new photo{files.length === 1 ? "" : "s"} ready to upload.</p> : null}
      </div>

      {initial ? (
        <div className="panel p-5 sm:p-7">
          <h2 className="section-heading">Countdowns</h2>
          <p className="mt-2 text-sm text-paper-dim">
            Add more from any countdown page with <span className="text-paper">Add to collection</span>.
          </p>
          {items.length ? (
            <ul className="mt-5 space-y-3">
              {items.map((item) => (
                <li key={item.slug} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3">
                  <Link href={collectionItemHref(item)} className="text-sm text-paper hover:text-amber">
                    {item.title}
                  </Link>
                  <button
                    type="button"
                    className="text-xs text-paper-dim hover:text-paper"
                    disabled={pending}
                    onClick={() => void onRemoveItem(item.slug)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-muted">No countdowns in this collection yet.</p>
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl border border-line bg-ink px-4 py-3 text-sm text-paper">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="button-primary" disabled={pending || !title.trim()}>
          {initial ? "Save collection" : "Create collection"}
        </button>
        <Link href={initial ? collectionHref(initial.owner.handle, initial.slug) : "/collections"} className="button-secondary">
          Cancel
        </Link>
        {initial ? (
          <button type="button" className="button-secondary" disabled={pending} onClick={() => void onDelete()}>
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}
