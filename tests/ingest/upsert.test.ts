import { describe, expect, it } from "vitest";
import { buildEvent, contentHash } from "@/lib/ingest/normalize";
import { prepareRows } from "@/lib/ingest/upsert";

function row(title: string, date: string, extra: Partial<Parameters<typeof buildEvent>[0]> = {}) {
  return buildEvent({ title, date, category: "culture", source: "curated", tags: ["a"], regions: ["US"], popularity: 40, ...extra });
}

describe("prepareRows", () => {
  it("drops invalid rows without throwing and reports them", () => {
    const good = row("Good Event", "2027-01-01");
    const bad = { ...row("Bad Event", "2027-01-01"), category: "nope" };
    const reserved = { ...row("Mine Event", "2027-01-01"), slug: "mine-event-2027-01-01" };
    const res = prepareRows([good, bad, reserved, { nonsense: true }]);
    expect(res.rows.map((r) => r.slug)).toEqual([good.slug]);
    expect(res.invalid).toBe(3);
    expect(res.errors.length).toBe(3);
  });
  it("dedupes by source_key (first wins)", () => {
    const a = row("Same Key", "2027-01-01", { popularity: 10 });
    const b = { ...row("Same Key", "2027-01-01", { popularity: 90 }), slug: "same-key-other-2027-01-01" };
    const res = prepareRows([a, b]);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].popularity).toBe(10);
    expect(res.dupKeys).toBe(1);
  });
  it("merges rows sharing a slug: tags/regions union, higher popularity, featured OR, rehashed", () => {
    const a = row("Perseid meteor shower peak", "2027-08-12", { tags: ["meteors"], regions: ["GLOBAL"], popularity: 58 });
    const b = row("Perseid meteor shower peak", "2027-08-12", { tags: ["perseids"], regions: ["US"], popularity: 68, featured: true, sourceKey: "wikidata:Q1" });
    const res = prepareRows([a, b]);
    expect(res.rows).toHaveLength(1);
    const m = res.rows[0];
    expect(m.source_key).toBe(a.source_key);
    expect(m.tags).toEqual(["meteors", "perseids"]);
    expect(m.regions).toEqual(["GLOBAL", "US"]);
    expect(m.popularity).toBe(68);
    expect(m.featured).toBe(true);
    expect(m.content_hash).toBe(contentHash(m));
    expect(res.dupSlugs).toBe(1);
  });
});
