import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/ingest/db";
import type { LicensedImage } from "@/lib/enrich/images/license";
import {
  buildDerivatives,
  downloadImage,
  hexColor,
  ImageError,
  isPermanentImageError,
  MIN_SOURCE_WIDTH,
  OG_MAX_BYTES,
  sha256Hex,
  type StorageLike,
  storeLicensedImage,
  uploadVariants,
  VARIANT_NAMES,
  variantPath,
} from "@/lib/enrich/images/process";
import { imageSize, imageUrl } from "@/lib/images";
import { thumbhashToDataUrl } from "@/lib/thumbhash";

const FIXTURE = join(process.cwd(), "tests", "fixtures", "enrich", "gradient-800x450.png");
const SOURCE = readFileSync(FIXTURE);
const SHA = "0".repeat(64);

const CANDIDATE: LicensedImage = {
  fileUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6b/Gradient.png",
  provider: "commons",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
  author: "A Photographer",
  credit: "Flickr",
  attributionRequired: true,
  originPage: "https://commons.wikimedia.org/wiki/File:Gradient.png",
  via: "pageimages",
};

/** Records every upload so the test can assert the object keys and cache headers. */
function stubStorage() {
  const uploads: Array<{ path: string; contentType: string; cacheControl: string; upsert: boolean; bytes: number }> = [];
  const storage: StorageLike = {
    from: (bucket: string) => ({
      async upload(path, body, options) {
        uploads.push({ path, contentType: options.contentType, cacheControl: options.cacheControl, upsert: options.upsert, bytes: body.byteLength });
        return { error: null };
      },
      getPublicUrl: (path: string) => ({
        data: { publicUrl: `https://ref.supabase.co/storage/v1/object/public/${bucket}/${path}` },
      }),
    }),
  };
  return { storage, uploads };
}

describe("variant naming", () => {
  it("stores every variant under the content-addressed prefix", () => {
    expect(VARIANT_NAMES).toEqual(["hero", "card", "og"]);
    expect(variantPath(SHA, "hero")).toBe(`${SHA}/hero.webp`);
    expect(variantPath(SHA, "card")).toBe(`${SHA}/card.webp`);
    expect(variantPath(SHA, "og")).toBe(`${SHA}/og.jpg`);
  });

  it("derives the sibling variants from the stored public url", () => {
    const image = { url: `https://ref.supabase.co/storage/v1/object/public/event-images/${SHA}/hero.webp`, width: 1600, height: 900 };
    expect(imageUrl(image, "card")).toBe(`https://ref.supabase.co/storage/v1/object/public/event-images/${SHA}/card.webp`);
    expect(imageUrl(image, "og")).toBe(`https://ref.supabase.co/storage/v1/object/public/event-images/${SHA}/og.jpg`);
    expect(imageUrl(image, "hero")).toBe(image.url);
  });

  it("leaves an unrecognised url untouched", () => {
    const image = { url: "https://example.com/curated.jpg", width: 1200, height: 800 };
    expect(imageUrl(image, "card")).toBe("https://example.com/curated.jpg");
  });

  it("computes zero-shift box sizes from the stored hero dimensions", () => {
    const image = { width: 1600, height: 1071 };
    expect(imageSize(image, "card")).toEqual({ width: 640, height: 428 });
    expect(imageSize(image, "og")).toEqual({ width: 1200, height: 630 });
    // Never upscales past what was stored.
    expect(imageSize({ width: 500, height: 250 }, "card")).toEqual({ width: 500, height: 250 });
  });
});

describe("buildDerivatives", () => {
  it("produces the three variants, a thumbhash and a dominant colour", async () => {
    const out = await buildDerivatives(SOURCE);
    expect(out.width).toBe(800); // withoutEnlargement: an 800px source stays 800px
    expect(out.height).toBe(450);
    expect(out.variants.hero?.contentType).toBe("image/webp");
    expect(out.variants.card?.contentType).toBe("image/webp");
    expect(out.variants.og?.contentType).toBe("image/jpeg");
    expect(out.variants.og?.body.byteLength).toBeLessThanOrEqual(OG_MAX_BYTES);
    expect(out.dominantColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(out.thumbhash.length).toBeGreaterThan(10);
  });

  it("turns the stored thumbhash into a usable blur placeholder", async () => {
    const out = await buildDerivatives(SOURCE);
    const dataUrl = thumbhashToDataUrl(out.thumbhash);
    expect(dataUrl?.startsWith("data:image/png;base64,")).toBe(true);
    expect(thumbhashToDataUrl(null)).toBeUndefined();
    expect(thumbhashToDataUrl("not base64 at all !!")).toBeUndefined();
  });

  it("rejects an image narrower than the minimum", async () => {
    const { default: sharp } = await import("sharp");
    const small = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#333" } }).png().toBuffer();
    await expect(buildDerivatives(small)).rejects.toThrow(ImageError);
    expect(MIN_SOURCE_WIDTH).toBe(800);
  });

  it("rejects bytes that are not an image", async () => {
    await expect(buildDerivatives(Buffer.from("<html>not an image</html>"))).rejects.toThrow(ImageError);
  });

  it("marks size and decode failures permanent so the job is parked, not retried forever", async () => {
    const { default: sharp } = await import("sharp");
    const small = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#333" } }).png().toBuffer();
    await expect(buildDerivatives(small)).rejects.toSatisfy(isPermanentImageError);
    await expect(buildDerivatives(Buffer.from("nope"))).rejects.toSatisfy(isPermanentImageError);
    // A transient HTTP failure is not permanent: that one is worth retrying.
    expect(isPermanentImageError(new ImageError("download failed: HTTP 503"))).toBe(false);
  });

  it("formats a dominant colour as hex", () => {
    expect(hexColor({ r: 0, g: 128, b: 255 })).toBe("#0080ff");
    expect(hexColor({ r: 300, g: -4, b: 12.6 })).toBe("#ff000d");
  });
});

describe("uploadVariants", () => {
  it("uploads all three objects with a one-year immutable cache and returns the hero url", async () => {
    const { storage, uploads } = stubStorage();
    const derivatives = await buildDerivatives(SOURCE);
    const url = await uploadVariants(storage, SHA, derivatives);
    expect(uploads.map((u) => u.path)).toEqual([`${SHA}/hero.webp`, `${SHA}/card.webp`, `${SHA}/og.jpg`]);
    expect(uploads.every((u) => u.cacheControl === "31536000" && u.upsert)).toBe(true);
    expect(uploads.map((u) => u.contentType)).toEqual(["image/webp", "image/webp", "image/jpeg"]);
    expect(url).toContain(`/event-images/${SHA}/hero.webp`);
  });

  it("surfaces a storage failure as an ImageError", async () => {
    const derivatives = await buildDerivatives(SOURCE);
    const failing: StorageLike = {
      from: () => ({
        async upload() {
          return { error: { message: "bucket full" } };
        },
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    };
    await expect(uploadVariants(failing, SHA, derivatives)).rejects.toThrow(/bucket full/);
  });
});

describe("sha256 reuse path", () => {
  const sha = sha256Hex(SOURCE);

  /** Minimal `Db` stand-in: `images` lookups answer from `rows`, inserts are recorded. */
  function stubDb(rows: Array<{ id: string; sha256: string; public_url: string; origin_url: string }>) {
    const inserted: Array<Record<string, unknown>> = [];
    const uploads: string[] = [];
    const db = {
      from(table: string) {
        if (table !== "images") throw new Error(`unexpected table ${table}`);
        const filters: Record<string, string> = {};
        const builder = {
          select: () => builder,
          eq(column: string, value: string) {
            filters[column] = value;
            return builder;
          },
          limit: () => builder,
          async maybeSingle() {
            const hit = rows.find((r) => Object.entries(filters).every(([k, v]) => (r as Record<string, string>)[k] === v));
            return { data: hit ?? null, error: null };
          },
          insert(row: Record<string, unknown>) {
            inserted.push(row);
            return {
              select: () => ({ single: async () => ({ data: { id: "new-image-id" }, error: null }) }),
            };
          },
        };
        return builder;
      },
      storage: {
        from: () => ({
          async upload(path: string) {
            uploads.push(path);
            return { error: null };
          },
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://ref.supabase.co/storage/v1/object/public/event-images/${path}` } }),
        }),
      },
    } as unknown as Db;
    return { db, inserted, uploads };
  }

  it("reuses a row that already points at the same origin url, without downloading", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { db, inserted } = stubDb([
      { id: "existing", sha256: sha, public_url: "https://ref/hero.webp", origin_url: CANDIDATE.fileUrl },
    ]);
    const stored = await storeLicensedImage(db, CANDIDATE);
    expect(stored).toEqual({ imageId: "existing", sha256: sha, reused: true, publicUrl: "https://ref/hero.webp" });
    expect(inserted).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("reuses a row with the same sha when the same file is served from a new url", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array(SOURCE), { status: 200, headers: { "content-type": "image/png" } }),
    );
    const { db, inserted, uploads } = stubDb([
      { id: "existing", sha256: sha, public_url: "https://ref/hero.webp", origin_url: "https://upload.wikimedia.org/other.png" },
    ]);
    const stored = await storeLicensedImage(db, CANDIDATE);
    expect(stored.reused).toBe(true);
    expect(stored.imageId).toBe("existing");
    expect(inserted).toHaveLength(0);
    expect(uploads).toHaveLength(0); // nothing re-uploaded: the objects are already there
    fetchSpy.mockRestore();
  });

  it("downloads, derives, uploads and inserts a new image the first time", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array(SOURCE), { status: 200, headers: { "content-type": "image/png" } }),
    );
    const { db, inserted, uploads } = stubDb([]);
    const stored = await storeLicensedImage(db, CANDIDATE);
    expect(stored.reused).toBe(false);
    expect(stored.sha256).toBe(sha);
    // CC BY-SA: no `og.jpg`. Cropping and overlaying it for the social card would be Adapted
    // Material, which brief §21 step 4 refuses — the card falls back to the gradient instead.
    expect(uploads).toEqual([`${sha}/hero.webp`, `${sha}/card.webp`]);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      sha256: sha,
      storage_path: sha,
      provider: "commons",
      license: "CC BY-SA 4.0",
      origin_url: CANDIDATE.fileUrl,
      attribution_required: true,
      credit: "Photo: A Photographer · CC BY-SA 4.0 · via Wikimedia Commons",
    });
    expect(stored.publicUrl).toContain(`/event-images/${sha}/hero.webp`);
    fetchSpy.mockRestore();
  });

  it("builds the og crop for a licence that allows adaptations", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array(SOURCE), { status: 200, headers: { "content-type": "image/png" } }),
    );
    const { db, uploads } = stubDb([]);
    await storeLicensedImage(db, { ...CANDIDATE, license: "CC BY 4.0" });
    expect(uploads).toEqual([`${sha}/hero.webp`, `${sha}/card.webp`, `${sha}/og.jpg`]);
    fetchSpy.mockRestore();
  });

  it("refuses a candidate whose host or licence never passed the gate", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { db } = stubDb([]);
    // The single write choke point re-checks both halves of the gate, so a future branch of the
    // discovery chain cannot smuggle a candidate past `license.ts`.
    await expect(
      storeLicensedImage(db, { ...CANDIDATE, fileUrl: "https://cdn.getty.example.com/paywalled.jpg" }),
    ).rejects.toThrow(/unlicensed candidate host/);
    await expect(storeLicensedImage(db, { ...CANDIDATE, license: "All rights reserved" })).rejects.toThrow(
      /unlicensed candidate/,
    );
    await expect(storeLicensedImage(db, { ...CANDIDATE, license: "" })).rejects.toThrow(/unlicensed candidate/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("stops reading a body that has no content-length once it passes the cap", async () => {
    const oversized = new Uint8Array(3 * 1024 * 1024);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      // No `content-length`: the cap can only be enforced while streaming.
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(oversized);
            controller.enqueue(oversized);
            controller.close();
          },
        }),
        { status: 200, headers: { "content-type": "image/png" } },
      ),
    );
    await expect(downloadImage("https://upload.wikimedia.org/wikipedia/commons/6/6b/Big.png", 4 * 1024 * 1024)).rejects.toThrow(
      /too large/,
    );
    fetchSpy.mockRestore();
  });

  it("refuses a download whose content-type is not an image", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }),
    );
    const { db } = stubDb([]);
    await expect(storeLicensedImage(db, CANDIDATE)).rejects.toThrow(/not an image/);
    fetchSpy.mockRestore();
  });
});
