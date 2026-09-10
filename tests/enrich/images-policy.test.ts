import { describe, expect, it, vi } from "vitest";
import { heroAspectRatio, isShareAlike, MIN_HERO_ASPECT, ogBackgroundUrl, shortCredit } from "@/lib/images";
import type { EventImage } from "@/lib/types";
import type { Db } from "@/lib/ingest/db";
import { dueForRecheck, recheckFileTitle, runRecheck } from "@/lib/enrich/recheck";
import { isSensitiveTitle } from "@/lib/enrich/images/resolve";

const IMAGE: EventImage = {
  url: "https://ref.supabase.co/storage/v1/object/public/event-images/abc/hero.webp",
  width: 1600,
  height: 900,
  author: "Krzysztof Golik",
  license: "CC BY 4.0",
  credit: "Photo: Krzysztof Golik · CC BY 4.0 · via Wikimedia Commons",
};

describe("ShareAlike gate", () => {
  it("recognises every ShareAlike spelling Commons uses", () => {
    for (const name of ["CC BY-SA 4.0", "CC BY-SA 3.0 IGO", "cc by sa 2.0", "Attribution-ShareAlike 3.0"]) {
      expect(isShareAlike(name), name).toBe(true);
    }
  });

  it("does not mistake other licences for ShareAlike", () => {
    for (const name of ["CC BY 4.0", "CC0 1.0", "Public domain", "NASA Image and Media Guidelines", "KOGL Type 1", undefined]) {
      expect(isShareAlike(name), String(name)).toBe(false);
    }
  });

  it("drops the OG background for a ShareAlike photo and keeps it for CC BY", () => {
    // Cropping to 1200x630 and overlaying title, counter and wordmark makes Adapted Material:
    // a BY-SA card would have to be licensed BY-SA itself, so the gradient is used instead.
    expect(ogBackgroundUrl({ ...IMAGE, license: "CC BY-SA 4.0" })).toBeNull();
    expect(ogBackgroundUrl(null)).toBeNull();
    expect(ogBackgroundUrl(IMAGE)).toBe(
      "https://ref.supabase.co/storage/v1/object/public/event-images/abc/og.jpg",
    );
  });
});

describe("card credit", () => {
  it("never truncates the licence, however long the author is", () => {
    const long = shortCredit({ ...IMAGE, author: "The President's Office of the Republic of Maldives Media Team" });
    expect(long).toContain("CC BY 4.0");
    expect(long?.length).toBeLessThan(50);
    expect(shortCredit({ ...IMAGE, author: undefined })).toBe("CC BY 4.0");
    expect(shortCredit({ author: undefined, license: undefined, credit: "Public domain" })).toBe("Public domain");
  });
});

describe("hero box", () => {
  it("clamps a portrait source so it cannot fill three viewports", () => {
    expect(heroAspectRatio({ width: 1600, height: 900 })).toBe("1600 / 900");
    expect(heroAspectRatio({ width: 1600, height: 3213 })).toBe(`${MIN_HERO_ASPECT} / 1`);
    expect(heroAspectRatio({ width: 0, height: 0 })).toBe("16 / 9");
  });
});

describe("sensitive rows", () => {
  it("flags incident-style titles and leaves ordinary ones alone", () => {
    expect(isSensitiveTitle("2026 Dhekunu Kandu cave diving incident")).toBe(true);
    expect(isSensitiveTitle("2026 All India Trinamool Congress split")).toBe(true);
    expect(isSensitiveTitle("Alpine Skiing World Cup Men's Super-G")).toBe(false);
    expect(isSensitiveTitle("Christmas Day")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Monthly licence re-check
// ---------------------------------------------------------------------------

type Row = { id: string; sha256: string; provider: string; license: string; origin_page: string | null; origin_url: string };

function stubDb(rows: Row[]) {
  const updates: Array<{ table: string; patch: Record<string, unknown> }> = [];
  const deletes: string[] = [];
  const removed: string[][] = [];

  const db = {
    from(table: string) {
      if (table === "images") {
        return {
          select: () => ({
            eq: () => ({ order: () => ({ limit: async () => ({ data: rows, error: null }) }) }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async () => {
              updates.push({ table, patch });
              return { error: null };
            },
          }),
          delete: () => ({
            eq: async (_col: string, id: string) => {
              deletes.push(id);
              return { error: null };
            },
          }),
        };
      }
      return {
        select: () => ({ eq: async () => ({ data: [{ slug: "an-event-2026-01-01" }], error: null }) }),
        update: (patch: Record<string, unknown>) => ({
          eq: async () => {
            updates.push({ table, patch });
            return { error: null };
          },
        }),
      };
    },
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          removed.push(paths);
          return { error: null };
        },
      }),
    },
  } as unknown as Db;
  return { db, updates, deletes, removed };
}

function ctxWith(verdicts: Record<string, { ok: boolean; license?: string }>) {
  return {
    http: {} as never,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    budget: { remainingMs: () => 60_000 },
    dryRun: false,
    verdicts,
  };
}

vi.mock("@/lib/enrich/images/commons", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/enrich/images/commons")>();
  class StubVerifier {
    constructor(private readonly ctx: { verdicts: Record<string, { ok: boolean; license?: string }> }) {}
    async warm(): Promise<void> {}
    async verify(name: string) {
      const verdict = this.ctx.verdicts[name];
      if (!verdict || !verdict.ok) return { ok: false as const, reason: "no imageinfo" };
      return {
        ok: true as const,
        image: {
          fileUrl: "https://upload.wikimedia.org/wikipedia/commons/1/11/X.jpg",
          provider: "commons" as const,
          license: verdict.license ?? "CC BY-SA 4.0",
          licenseUrl: null,
          author: "A Photographer",
          credit: null,
          attributionRequired: true,
          originPage: null,
          via: "recheck",
        },
      };
    }
  }
  return { ...actual, CommonsVerifier: StubVerifier };
});

describe("licence re-check", () => {
  const row: Row = {
    id: "img-1",
    sha256: "a".repeat(64),
    provider: "commons",
    license: "CC BY-SA 4.0",
    origin_page: "https://commons.wikimedia.org/wiki/File:Ashura_Mourning.jpg",
    origin_url: "https://upload.wikimedia.org/wikipedia/commons/1/11/Ashura_Mourning.jpg",
  };

  it("finds the file title behind a stored row", () => {
    expect(recheckFileTitle(row)).toBe("File:Ashura Mourning.jpg");
    expect(recheckFileTitle({ origin_page: null, origin_url: row.origin_url })).toBe("File:Ashura Mourning.jpg");
    expect(recheckFileTitle({ origin_page: null, origin_url: "https://example.com/x.jpg" })).toBeNull();
  });

  it("bumps last_checked_at when the file is still free", async () => {
    const { db, updates } = stubDb([row]);
    const summary = await runRecheck(
      db,
      ctxWith({ "File:Ashura Mourning.jpg": { ok: true } }) as never,
    );
    expect(summary).toMatchObject({ checked: 1, ok: 1, dropped: 0, relicensed: 0 });
    expect(updates).toHaveLength(1);
    expect(Object.keys(updates[0].patch)).toEqual(["last_checked_at"]);
  });

  it("rewrites the credit when the licence changed but is still free", async () => {
    const { db, updates } = stubDb([row]);
    const summary = await runRecheck(
      db,
      ctxWith({ "File:Ashura Mourning.jpg": { ok: true, license: "CC BY 4.0" } }) as never,
    );
    expect(summary.relicensed).toBe(1);
    expect(updates[0].patch).toMatchObject({
      license: "CC BY 4.0",
      credit: "Photo: A Photographer · CC BY 4.0 · via Wikimedia Commons",
    });
  });

  it("drops the image, its objects and the events pointing at it when it stops being free", async () => {
    const { db, updates, deletes, removed } = stubDb([row]);
    const summary = await runRecheck(db, ctxWith({}) as never);
    expect(summary).toMatchObject({ checked: 1, ok: 0, dropped: 1 });
    expect(summary.changed).toEqual(["an-event-2026-01-01"]);
    expect(updates.some((u) => u.table === "events" && u.patch.image_status === "skip")).toBe(true);
    expect(removed[0]).toEqual([`${row.sha256}/hero.webp`, `${row.sha256}/card.webp`, `${row.sha256}/og.jpg`]);
    expect(deletes).toEqual(["img-1"]);
  });

  it("writes nothing on a dry run", async () => {
    const { db, updates, deletes, removed } = stubDb([row]);
    const summary = await runRecheck(db, ctxWith({}) as never, { dryRun: true });
    expect(summary.dropped).toBe(1);
    expect(updates).toHaveLength(0);
    expect(deletes).toHaveLength(0);
    expect(removed).toHaveLength(0);
  });

  it("asks the database for the oldest checked Commons rows", async () => {
    const { db } = stubDb([row]);
    await expect(dueForRecheck(db, 25)).resolves.toEqual([row]);
  });
});
