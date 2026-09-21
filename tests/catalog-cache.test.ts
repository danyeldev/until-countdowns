import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  now: 0,
  reads: [] as string[],
  entries: new Map<string, { tags: string[]; expires: number; value: unknown }>(),
}));

// Exercise the catalog's cache dependency contract. Next itself supplies the cache;
// this fake models tag invalidation and elapsed TTL without a production database.
vi.mock("next/cache", () => ({
  unstable_cache: (
    fn: (...args: unknown[]) => Promise<unknown>,
    parts: string[],
    options: { tags: string[]; revalidate: number },
  ) => async (...args: unknown[]) => {
    const key = JSON.stringify([parts, args]);
    const hit = state.entries.get(key);
    if (hit && hit.expires > state.now) return hit.value;
    const value = await fn(...args);
    state.entries.set(key, { tags: options.tags, expires: state.now + options.revalidate, value });
    return value;
  },
  revalidateTag: (tag: string) => {
    for (const [key, entry] of state.entries) {
      if (entry.tags.includes(tag)) state.entries.delete(key);
    }
  },
}));

vi.mock("@/lib/db/client", () => ({
  supabaseEnv: () => ({ url: "https://database.example", key: "public-test-key" }),
  anonClient: () => ({
    from: (table: string) => {
      const value = table === "series" ? { recurrence: null } : {
        id: "event-1", slug: "example-2027-01-01", title: "Example", date: "2027-01-01",
        series_slug: "example", external_ids: { summary_source: "wikipedia", enwiki: "Example" },
      };
      const finish = (data: unknown) => {
        state.reads.push(table);
        return Promise.resolve({ data, error: null });
      };
      const query = {
        select: () => query,
        eq: () => query,
        not: () => query,
        gt: () => query,
        order: () => query,
        maybeSingle: () => finish(value),
        limit: () => finish([value]),
      };
      return query;
    },
    rpc: async (name: string) => {
      state.reads.push(name);
      return { data: [], error: null };
    },
  }),
}));

import { getEventStrict, relatedEvents, seriesOccurrences, summaryCitation } from "@/lib/catalog";
import { eventTag, invalidateTags, TAG_CATALOG_LISTS } from "@/lib/cache";
import { POST } from "@/app/api/revalidate/route";

async function readEventPage() {
  const event = await getEventStrict("example-2027-01-01");
  expect(event?.title).toBe("Example");
  await Promise.all([
    summaryCitation(event!.slug),
    relatedEvents(event!),
    seriesOccurrences(event!.seriesSlug!, 8),
  ]);
}

beforeEach(() => {
  state.entries.clear();
  state.reads.length = 0;
  state.now = 0;
  vi.stubEnv("CRON_SECRET", "test-secret");
});
afterEach(() => vi.unstubAllEnvs());

describe("catalog cache isolation", () => {
  it("keeps the complete event read warm after a hub refresh and the old 15-minute interval", async () => {
    await readEventPage();
    const coldReads = state.reads.length;
    expect(coldReads).toBeGreaterThan(0);
    invalidateTags([TAG_CATALOG_LISTS]);
    state.now = 901;
    await readEventPage();
    expect(state.reads).toHaveLength(coldReads);

    state.now = 3601;
    await readEventPage();
    expect(state.reads).toHaveLength(coldReads * 2);
  });

  it("still refreshes the changed event and its citation after targeted enrichment", async () => {
    await readEventPage();
    const coldReads = state.reads.length;
    invalidateTags([eventTag("example-2027-01-01")]);
    await readEventPage();
    expect(state.reads).toHaveLength(coldReads + 2);
  });

  it("preserves an authenticated full catalog refresh for urgent corrections", async () => {
    await readEventPage();
    const coldReads = state.reads.length;
    const response = POST(new NextRequest("https://until.example/api/revalidate", {
      headers: { authorization: "Bearer test-secret" },
    }));
    expect(await response.json()).toMatchObject({ revalidated: ["events", "catalog-lists", "stats"] });
    await readEventPage();
    expect(state.reads).toHaveLength(coldReads * 2);
  });

  it("does not permit an anonymous request to evict the catalog", async () => {
    await readEventPage();
    const coldReads = state.reads.length;
    expect(POST(new NextRequest("https://until.example/api/revalidate")).status).toBe(401);
    await readEventPage();
    expect(state.reads).toHaveLength(coldReads);
  });
});
