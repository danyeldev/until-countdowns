import { describe, expect, it } from "vitest";
import type { EnrichContext } from "@/lib/enrich/context";
import {
  type EnrichableEvent,
  enrichSummary,
  isPlaceholderDescription,
  needsSummary,
  readEnwiki,
  readQid,
  resolveEnwikiTitle,
  titleFromWikipediaUrl,
  titleSimilarity,
  trimExtract,
} from "@/lib/enrich/wikipedia";

/** A context whose HTTP layer answers from a fixed table and records what was asked. */
function stubContext(responses: Record<string, unknown>): EnrichContext & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    budget: { remainingMs: () => 60_000 },
    dryRun: false,
    log: { info: () => {}, warn: () => {}, error: () => {} },
    http: {
      async fetchJson<T>(url: string): Promise<T> {
        calls.push(url);
        const key = Object.keys(responses).find((k) => url.includes(k));
        if (!key) throw new Error(`unexpected request: ${url}`);
        return responses[key] as T;
      },
      async fetchText(): Promise<string> {
        throw new Error("not used");
      },
    },
  };
}

function event(patch: Partial<EnrichableEvent> = {}): EnrichableEvent {
  return {
    id: "e1",
    slug: "ugadi-2027-04-07",
    title: "Ugadi",
    description: "",
    summary: null,
    source_url: null,
    external_ids: {},
    ...patch,
  };
}

describe("title similarity", () => {
  it("scores an exact match at 1", () => {
    expect(titleSimilarity("Ugadi", "Ugadi")).toBe(1);
    expect(titleSimilarity("2028 Summer Olympics", "2028 summer olympics")).toBe(1);
  });

  it('keeps "Christmas Day" vs "Christmas" below the confidence bar', () => {
    expect(titleSimilarity("Christmas", "Christmas Day")).toBeLessThan(0.8);
  });

  it("rejects a same-word-different-subject pair", () => {
    expect(titleSimilarity("Apophis", "Apep")).toBeLessThan(0.8);
  });

  it("accepts a near-identical title with punctuation drift", () => {
    expect(titleSimilarity("2025–26 Men's FIH Hockey Nations Cup", "2025-26 Men's FIH Hockey Nations Cup")).toBeGreaterThanOrEqual(0.8);
  });
});

describe("title from a source url", () => {
  it("reads the article from an en.wikipedia path", () => {
    expect(titleFromWikipediaUrl("https://en.wikipedia.org/wiki/Diwali#Origins")).toBe("Diwali");
    expect(titleFromWikipediaUrl("https://en.wikipedia.org/wiki/2028_Summer_Olympics")).toBe("2028 Summer Olympics");
  });

  it("ignores other wikis, namespaces and non-urls", () => {
    expect(titleFromWikipediaUrl("https://de.wikipedia.org/wiki/Diwali")).toBeNull();
    expect(titleFromWikipediaUrl("https://en.wikipedia.org/wiki/File:X.jpg")).toBeNull();
    expect(titleFromWikipediaUrl("https://openholidaysapi.org/PublicHolidays?x=1")).toBeNull();
    expect(titleFromWikipediaUrl(null)).toBeNull();
  });
});

describe("external id readers", () => {
  it("accepts a well-formed QID and an enwiki title", () => {
    expect(readQid({ qid: "Q117271707" })).toBe("Q117271707");
    expect(readEnwiki({ enwiki: "Forever Skies" })).toBe("Forever Skies");
  });

  it("rejects malformed ids", () => {
    expect(readQid({ qid: "P31" })).toBeNull();
    expect(readQid({})).toBeNull();
    expect(readEnwiki({ enwiki: "" })).toBeNull();
  });
});

describe("summary gate", () => {
  it("fills in an empty or placeholder description", () => {
    expect(needsSummary({ description: "", summary: null })).toBe(true);
    expect(needsSummary({ description: "TBD", summary: null })).toBe(true);
    expect(isPlaceholderDescription("Scheduled event.")).toBe(true);
  });

  it("fills in a description under 80 characters", () => {
    expect(needsSummary({ description: "A public holiday in Andorra.", summary: null })).toBe(true);
  });

  it("leaves a description that already meets the bar alone", () => {
    const description =
      "Christmas Day is an official public holiday that falls on Friday, 25 December 2026. Government offices close.";
    expect(description.length).toBeGreaterThan(80);
    expect(needsSummary({ description, summary: null })).toBe(false);
  });

  it("never overwrites a summary that already exists", () => {
    expect(needsSummary({ description: "", summary: "Already enriched." })).toBe(false);
  });

  it("trims a long extract at a sentence boundary", () => {
    const long = `${"Sentence one is here. ".repeat(60)}Tail.`;
    const trimmed = trimExtract(long);
    expect(trimmed.length).toBeLessThanOrEqual(700);
    expect(trimmed.endsWith(".")).toBe(true);
  });
});

describe("title resolution order", () => {
  it("uses external_ids.enwiki without any network call", async () => {
    const ctx = stubContext({});
    const resolved = await resolveEnwikiTitle(ctx, event({ external_ids: { enwiki: "Forever Skies" } }));
    expect(resolved).toEqual({ title: "Forever Skies", via: "external_ids" });
    expect(ctx.calls).toHaveLength(0);
  });

  it("follows a QID to its enwiki sitelink", async () => {
    const ctx = stubContext({
      "Special:EntityData/Q117271707.json": { entities: { Q117271707: { sitelinks: { enwiki: { title: "Forever Skies" } } } } },
    });
    const resolved = await resolveEnwikiTitle(ctx, event({ external_ids: { qid: "Q117271707" } }));
    expect(resolved).toEqual({ title: "Forever Skies", via: "wikidata" });
  });

  it("falls back to the source url when the QID has no English article", async () => {
    const ctx = stubContext({ "Special:EntityData/Q1.json": { entities: { Q1: { sitelinks: {} } } } });
    const resolved = await resolveEnwikiTitle(
      ctx,
      event({ external_ids: { qid: "Q1" }, source_url: "https://en.wikipedia.org/wiki/Ugadi" }),
    );
    expect(resolved).toEqual({ title: "Ugadi", via: "source_url" });
  });

  it("accepts a search hit that closely matches the event title", async () => {
    const ctx = stubContext({ "list=search": { query: { search: [{ title: "Forever Skies" }] } } });
    const resolved = await resolveEnwikiTitle(ctx, event({ title: "Forever Skies" }));
    expect(resolved).toEqual({ title: "Forever Skies", via: "search" });
  });

  it('refuses the loose search hit for "Christmas Day" rather than guessing', async () => {
    const ctx = stubContext({ "list=search": { query: { search: [{ title: "Christmas" }] } } });
    const resolved = await resolveEnwikiTitle(ctx, event({ title: "Christmas Day" }));
    expect(resolved).toBeNull();
  });
});

describe("enrichSummary", () => {
  it("writes the extract and the CC BY-SA citation fields", async () => {
    const ctx = stubContext({
      "page/summary/Ugadi": {
        type: "standard",
        title: "Ugadi",
        titles: { canonical: "Ugadi" },
        extract: "Ugadi is the New Year's Day for the states of Andhra Pradesh, Telangana and Karnataka in India.",
      },
    });
    const outcome = await enrichSummary(ctx, event({ external_ids: { enwiki: "Ugadi" }, description: "" }));
    expect(outcome.status).toBe("done");
    if (outcome.status !== "done") return;
    expect(outcome.patch.summary).toContain("New Year's Day");
    expect(outcome.patch.external_ids.enwiki).toBe("Ugadi");
    expect(outcome.patch.external_ids.summary_source).toBe("wikipedia");
  });

  it("skips a good description but still records the resolved article", async () => {
    const ctx = stubContext({
      "Special:EntityData/Q2.json": { entities: { Q2: { sitelinks: { enwiki: { title: "Christmas" } } } } },
    });
    const outcome = await enrichSummary(
      ctx,
      event({
        external_ids: { qid: "Q2" },
        description: "Christmas Day is an official public holiday that falls on Friday, 25 December 2026. Offices close.",
      }),
    );
    expect(outcome.status).toBe("skipped");
    expect(outcome.patch?.external_ids.enwiki).toBe("Christmas");
    expect(outcome.patch?.summary).toBeUndefined();
    expect(outcome.patch?.external_ids.summary_source).toBeUndefined();
  });

  it("skips a disambiguation page", async () => {
    const ctx = stubContext({ "page/summary/Mercury": { type: "disambiguation", extract: "Mercury may refer to:" } });
    const outcome = await enrichSummary(ctx, event({ title: "Mercury", external_ids: { enwiki: "Mercury" } }));
    expect(outcome.status).toBe("skipped");
    expect(outcome.status === "skipped" && outcome.reason).toBe("no usable extract");
  });

  it("skips when no title can be resolved confidently", async () => {
    const ctx = stubContext({ "list=search": { query: { search: [] } } });
    const outcome = await enrichSummary(ctx, event({ title: "National Day" }));
    expect(outcome.status).toBe("skipped");
    expect(outcome.patch).toBeUndefined();
  });
});
