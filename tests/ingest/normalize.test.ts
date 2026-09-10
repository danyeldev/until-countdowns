import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildEvent,
  classify,
  contentHash,
  decodeEntities,
  isFarFuture,
  periodEnd,
  precisionFromWikidata,
  rejectReserved,
  sanitizeTitle,
  slugify,
  stableStringify,
} from "@/lib/ingest/normalize";
import { IngestEventSchema } from "@/lib/ingest/types";

const NOW = new Date("2026-09-09T12:00:00Z");

describe("slugify", () => {
  it("matches the seed scheme (lowercase, ascii, dashes, 80 chars)", () => {
    expect(slugify("New Year's Day")).toBe("new-year-s-day");
    expect(slugify("Día de los Muertos")).toBe("dia-de-los-muertos");
    expect(slugify("  Süßes -- Ünïcode! ")).toBe("su-es-unicode"); // ß has no NFKD decomposition, same as the seed
    expect(slugify("x".repeat(100))).toHaveLength(80);
  });
});

describe("classify", () => {
  it("applies TAG_RULES in order and falls back", () => {
    expect(classify("Christmas Day")).toEqual({ category: "holidays", tags: ["christmas", "religious"] });
    expect(classify("Independence Day", "holidays").tags).toContain("national");
    expect(classify("Perseid meteor shower peak").category).toBe("astronomy");
    expect(classify("Something else", "culture")).toEqual({ category: "culture", tags: [] });
  });
});

describe("sanitizeTitle", () => {
  it("strips tags, reference markers and entities, collapses whitespace", () => {
    expect(sanitizeTitle('Super Bowl<sup class="reference">[1]</sup> &amp;   LXI[citation needed]')).toBe("Super Bowl & LXI");
    expect(sanitizeTitle("A <b>bold</b>\n\ttitle &ndash; here<ref>x</ref>")).toBe("A bold title – here");
    expect(decodeEntities("&#8211; &#x2014; &quot;")).toBe("– — \"");
  });
  it("caps at 200 characters on a word boundary", () => {
    const t = sanitizeTitle(`${"word ".repeat(60)}end`);
    expect(t.length).toBeLessThanOrEqual(200);
    expect(t.endsWith("word")).toBe(true);
  });
});

describe("contentHash", () => {
  const base = {
    title: "T",
    description: "d",
    date: "2027-01-01",
    end_date: null,
    all_day: true,
    category: "culture" as const,
    tags: ["b", "a"],
    regions: ["US", "GLOBAL"],
    source: "curated" as const,
    source_url: null,
    featured: false,
    popularity: 50,
    status: "scheduled" as const,
    date_precision: "day" as const,
    confidence: 1,
    external_ids: { qid: "Q1", enwiki: "X" },
  };
  it("is stable across tag/region/external_ids ordering", () => {
    const a = contentHash(base);
    const b = contentHash({ ...base, tags: ["a", "b"], regions: ["GLOBAL", "US"], external_ids: { enwiki: "X", qid: "Q1" } });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("changes with content and with a series link, but not with null series", () => {
    expect(contentHash({ ...base, popularity: 51 })).not.toBe(contentHash(base));
    expect(contentHash({ ...base, series_slug: null })).toBe(contentHash(base));
    expect(contentHash({ ...base, series_slug: "t" })).not.toBe(contentHash(base));
  });
  it("matches the push-catalog hash for a known row", () => {
    // Same JSON shape as scripts/push-catalog.mjs contentHash: sha256(JSON.stringify({...}))
    const expected = createHash("sha256")
      .update(
        JSON.stringify({
          title: "T", description: "d", date: "2027-01-01", end_date: null, all_day: true, category: "culture",
          tags: ["a", "b"], regions: ["GLOBAL", "US"], source: "curated", source_url: null, featured: false,
          popularity: 50, status: "scheduled", date_precision: "day", confidence: 1, external_ids: { enwiki: "X", qid: "Q1" },
        }),
      )
      .digest("hex");
    expect(contentHash(base)).toBe(expected);
  });
});

describe("stableStringify", () => {
  it("sorts keys recursively and drops undefined", () => {
    expect(stableStringify({ b: 1, a: { d: undefined, c: [3, { z: 1, y: 2 }] } })).toBe('{"a":{"c":[3,{"y":2,"z":1}]},"b":1}');
  });
});

describe("far-future guard", () => {
  it("drops rows more than 15 years out unless tagged far-future", () => {
    expect(isFarFuture("2045-08-12", [], NOW)).toBe(true);
    expect(isFarFuture("2045-08-12", ["far-future"], NOW)).toBe(false);
    expect(isFarFuture("2041-01-01", [], NOW)).toBe(false);
  });
});

describe("precision helpers", () => {
  it("maps Wikidata precisions and computes period ends", () => {
    expect(precisionFromWikidata(11)).toBe("day");
    expect(precisionFromWikidata(9)).toBe("year");
    expect(precisionFromWikidata(7)).toBeNull();
    expect(periodEnd("2027-01-01", "year")).toBe("2027-12-31");
    expect(periodEnd("2027-02-01", "month")).toBe("2027-02-28");
    expect(periodEnd("2027-04-01", "quarter")).toBe("2027-06-30");
  });
});

describe("buildEvent", () => {
  it("builds a valid row with slug slugify(title)-YYYY-MM-DD and default source_key", () => {
    const ev = buildEvent({
      title: "  Boston Marathon  ",
      date: "2027-04-19",
      category: "sports",
      tags: ["Running", "marathon"],
      regions: ["US"],
      description: "x",
      source: "curated",
      popularity: 66,
    });
    expect(ev.slug).toBe("boston-marathon-2027-04-19");
    expect(ev.source_key).toBe("curated:boston-marathon-2027-04-19");
    expect(ev.tags).toEqual(["running", "marathon"]);
    expect(ev.confidence).toBe(1);
    expect(ev.status).toBe("scheduled");
    expect(IngestEventSchema.safeParse(ev).success).toBe(true);
  });
  it("marks coarse precision tentative, keeps instants, drops inverted end dates", () => {
    const y = buildEvent({ title: "Artemis III", date: "2027-01-01", category: "space", source: "curated", datePrecision: "year" });
    expect(y.status).toBe("tentative");
    const i = buildEvent({ title: "Y2K38", date: "2038-01-19T03:14:07Z", category: "tech", source: "curated", allDay: false });
    expect(i.date_precision).toBe("instant");
    expect(i.all_day).toBe(false);
    expect(i.slug).toBe("y2k38-2038-01-19");
    const e = buildEvent({ title: "Bad range", date: "2027-05-02", endDate: "2027-05-01", category: "culture", source: "curated" });
    expect(e.end_date).toBeNull();
  });
  it("rejects reserved slugs through the schema", () => {
    expect(rejectReserved("mine-foo")).toBe(true);
    const ev = buildEvent({ title: "Mine thing", date: "2027-01-01", category: "culture", source: "curated" });
    expect(IngestEventSchema.safeParse({ ...ev, slug: "mine-thing-2027-01-01" }).success).toBe(false);
    expect(IngestEventSchema.safeParse({ ...ev, slug: "share-thing-2027-01-01" }).success).toBe(false);
  });
});

describe("slug fallback for titles without Latin letters", () => {
  it("buildEvent never produces an empty slug base; the fallback is deterministic and title-specific", () => {
    const a = buildEvent({ title: "عيد الإستقلال", date: "2028-03-20", category: "holidays", source: "holidays", slugFallbackPrefix: "holiday-TN" });
    const b = buildEvent({ title: "عيد الشهداء", date: "2028-03-20", category: "holidays", source: "holidays", slugFallbackPrefix: "holiday-TN" });
    const again = buildEvent({ title: "عيد الإستقلال", date: "2028-03-20", category: "holidays", source: "holidays", slugFallbackPrefix: "holiday-TN" });
    expect(a.slug).toMatch(/^holiday-tn-[0-9a-f]{8}-2028-03-20$/);
    expect(a.slug).toBe(again.slug);
    expect(a.slug).not.toBe(b.slug);
    expect(a.source_key).toBe(`holidays:${a.slug}`);
    expect(IngestEventSchema.safeParse(a).success).toBe(true);
    const thai = buildEvent({ title: "วันสงกรานต์", date: "2027-04-13", category: "holidays", source: "holidays" });
    expect(thai.slug).toMatch(/^holidays-[0-9a-f]{8}-2027-04-13$/);
  });
  it("the schema rejects slugs with an empty base", () => {
    const row = buildEvent({ title: "Independence Day", date: "2028-03-20", category: "holidays", source: "holidays" });
    expect(IngestEventSchema.safeParse({ ...row, slug: "-2028-03-20" }).success).toBe(false);
    expect(IngestEventSchema.safeParse({ ...row, slug: "--2028-03-20" }).success).toBe(false);
    expect(IngestEventSchema.safeParse(row).success).toBe(true);
  });
});

describe("sports classification", () => {
  it("wins over the family rule and recognises games/cups/leagues", () => {
    for (const title of [
      "2026 Summer Youth Olympics",
      "2026 Asian Games",
      "2027 AFC Asian Cup final",
      "2027 UEFA Champions League final",
      "2027 UEFA Europa League final",
      "2027 Australian Open",
      "Stanley Cup Finals",
    ]) {
      expect(classify(title, "culture").category, title).toBe("sports");
    }
    expect(classify("Universal Children's Day", "culture").tags).toEqual(["family"]);
    expect(classify("Final Fantasy XVII", "games").category).toBe("games");
    expect(classify("Justice League Unlimited", "film").category).toBe("film");
    expect(classify("Video Games Day", "culture").category).toBe("culture");
  });
});

describe("classify: a surname is not a feast day", () => {
  it("does not read Whitlock, Whittaker or White as Whitsun", () => {
    // `whit` used to be an unanchored alternative in the Christian-feast rule, so a UFC card came
    // back tagged religious and categorised as a holiday. Robert Whittaker is a real fighter.
    for (const title of ["UFC 349: Ferreira vs. Whitlock", "UFC 320: Whittaker vs. Costa", "Dana White's Contender Series"]) {
      expect(classify(title, "sports")).toEqual({ category: "sports", tags: [] });
    }
    expect(classify("Amazon Kindle Paperwhite (11th Generation) end of life", "tech").tags).toEqual([]);
  });

  it("still reads the feast it was written for", () => {
    for (const title of ["Whit Sunday", "Whit Monday", "Whitsun", "Whitsuntide"]) {
      expect(classify(title, "sports")).toEqual({ category: "holidays", tags: ["religious", "christian"] });
    }
  });
});
