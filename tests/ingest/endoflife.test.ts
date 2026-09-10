import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { IngestEventSchema, type IngestContext } from "@/lib/ingest/types";
import {
  adapter,
  assertSchema,
  describe as describeMilestone,
  EOL_ENDPOINT,
  MAX_ROWS,
  MILESTONES,
  MIN_PRODUCTS,
  milestoneToEvent,
  normalizeDate,
  parseCursor,
  payloadToEvents,
  planUnits,
  popularityFor,
  productTitle,
  resetCache,
  resumeIndex,
  sliceUnit,
  titleFor,
  type EolPayload,
  type EolProduct,
  type EolRelease,
} from "@/lib/ingest/sources/endoflife";

const NOW = new Date("2026-09-09T12:00:00Z");
/** The real payload has ≈ 470 products; the trimmed fixtures are padded with empty products past the `MIN_PRODUCTS` floor. */
const FILLER: EolProduct[] = Array.from({ length: MIN_PRODUCTS }, (_, i) => ({ name: `filler-${i}`, releases: [] }));
const pad = <T extends EolPayload>(payload: T): T & { result: EolProduct[] } => ({
  ...payload,
  result: [...(payload.result as EolProduct[]), ...FILLER],
});
const FIXTURE: EolPayload & { result: EolProduct[] } = pad(
  JSON.parse(readFileSync(new URL("../fixtures/endoflife/full-sample.json", import.meta.url), "utf8")),
);
const PYTHON: EolPayload = pad(JSON.parse(readFileSync(new URL("../fixtures/endoflife/products-python.json", import.meta.url), "utf8")));

const product = (name: string) => FIXTURE.result.find((p) => p.name === name)!;
const release = (p: EolProduct, name: string) => p.releases!.find((r) => r.name === name)!;
const spec = (id: string) => MILESTONES.find((m) => m.id === id)!;

function ctxFor(body: unknown, calls: string[] = [], now = NOW): IngestContext {
  return {
    http: {
      fetchJson: async <T,>(url: string) => {
        calls.push(url);
        return body as T;
      },
      fetchText: async () => "",
    },
    log: { info() {}, warn() {}, error() {} },
    now,
    budget: { remainingMs: () => 60_000 },
    dryRun: true,
  };
}

beforeEach(() => resetCache());

describe("endoflife helpers", () => {
  it("normalizeDate: day, month (first of month), and garbage", () => {
    expect(normalizeDate("2030-10-31")).toEqual({ date: "2030-10-31", precision: "day" });
    expect(normalizeDate("2030-10")).toEqual({ date: "2030-10-01", precision: "month" });
    expect(normalizeDate("2030-13-01")).toBeNull();
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate(true)).toBeNull();
    expect(normalizeDate("soon")).toBeNull();
  });
  it("productTitle strips the product name the release label repeats", () => {
    expect(productTitle({ name: "windows-server", label: "Microsoft Windows Server" }, { name: "2025", label: "Windows Server 2025 (LTSC)" })).toBe(
      "Microsoft Windows Server 2025 (LTSC)",
    );
    expect(productTitle({ name: "macos", label: "Apple macOS" }, { name: "26", label: "macOS 26 (Tahoe)" })).toBe("Apple macOS 26 (Tahoe)");
    expect(productTitle({ name: "almalinux", label: "AlmaLinux OS" }, { name: "10", label: "AlmaLinux OS 10" })).toBe("AlmaLinux OS 10");
    expect(productTitle(product("python"), release(product("python"), "3.14"))).toBe("Python 3.14");
    expect(productTitle({ name: "foo" }, { name: "1" })).toBe("foo 1");
  });
  it("productTitle spells a lone '+' in the release label as ' Plus' (distinct slug from the base model)", () => {
    const tab = { name: "samsung-galaxy-tab", label: "Samsung Galaxy Tab" };
    expect(productTitle(tab, { name: "galaxy-tab-a9+", label: "Galaxy Tab A9+" })).toBe("Samsung Galaxy Tab A9 Plus");
    expect(productTitle(tab, { name: "galaxy-tab-a9", label: "Galaxy Tab A9" })).toBe("Samsung Galaxy Tab A9");
    expect(productTitle({ name: "motorola-mobile", label: "Motorola Mobile" }, { name: "razr+-2024", label: "Razr+ 2024" })).toBe(
      "Motorola Mobile Razr Plus 2024",
    );
    expect(productTitle({ name: "raspberry-pi", label: "Raspberry Pi" }, { name: "cm3+", label: "Compute Module 3+" })).toBe(
      "Raspberry Pi Compute Module 3 Plus",
    );
    // Product label untouched; '++' inside a release label is not a variant marker.
    expect(productTitle({ name: "notepad-plus-plus", label: "Notepad++" }, { name: "8.9", label: "8.9" })).toBe("Notepad++ 8.9");
    expect(productTitle({ name: "gcc", label: "GCC" }, { name: "c++17", label: "C++17" })).toBe("GCC C++17");
    expect(titleFor(product("ubuntu"), release(product("ubuntu"), "26.04"), "eoes")).toBe("Ubuntu 26.04 'Resolute Raccoon' (LTS) end of extended support");
    expect(titleFor(product("nodejs"), release(product("nodejs"), "26"), "lts")).toBe("Node.js 26 LTS begins");
    expect(titleFor(product("nodejs"), release(product("nodejs"), "26"), "eol")).toBe("Node.js 26 (Upcoming LTS) end of life");
  });
  it("popularity: base 25, marquee 40, eol +5, caps 35 / 45", () => {
    expect(popularityFor("python", "eol")).toBe(45);
    expect(popularityFor("python", "eoas")).toBe(40);
    expect(popularityFor("mssqlserver", "eol")).toBe(45);
    expect(popularityFor("cockroachdb", "eol")).toBe(30);
    expect(popularityFor("cockroachdb", "lts")).toBe(25);
  });
  it("descriptions are own wording with the dates, at least two sentences and 80 chars", () => {
    const py = product("python");
    const r = release(py, "3.14");
    const eol = describeMilestone(py, r, "eol", "2030-10-31", "day", NOW);
    expect(eol).toContain("Python 3.14 reaches end of life on October 31, 2030");
    expect(eol).toContain("It was released on October 7, 2025.");
    expect(eol.length).toBeGreaterThanOrEqual(80);
    expect(eol.split(/\.\s/).length).toBeGreaterThanOrEqual(2);
    const ub = product("ubuntu");
    const eoes = describeMilestone(ub, release(ub, "26.04"), "eoes", "2036-04-23", "day", NOW);
    expect(eoes).toContain("end of expanded security maintenance on April 23, 2036");
    expect(eoes).toContain("regular end of life was May 29, 2031");
    const month = describeMilestone(py, r, "eol", "2030-10-01", "month", NOW);
    expect(month).toContain("October 2030");
  });
});

describe("endoflife milestone → event", () => {
  it("python 3.14 eol: slug, key, tech category, tags, day precision, scheduled, confidence 0.9", () => {
    const py = product("python");
    const r = milestoneToEvent(py, release(py, "3.14"), spec("eol"), NOW);
    expect(r && "event" in r).toBe(true);
    const ev = (r as { event: ReturnType<typeof Object> })!.event as ReturnType<typeof payloadToEvents>[number];
    expect(ev.slug).toBe("python-3-14-end-of-life-2030-10-31");
    expect(ev.source_key).toBe("endoflife:python:3.14:eol");
    expect(ev.title).toBe("Python 3.14 end of life");
    expect(ev.date).toBe("2030-10-31");
    expect(ev.all_day).toBe(true);
    expect(ev.timezone).toBeNull();
    expect(ev.date_precision).toBe("day");
    expect(ev.status).toBe("scheduled");
    expect(ev.category).toBe("tech");
    expect(ev.tags).toEqual(["endoflife", "eol", "python", "lang"]);
    expect(ev.regions).toEqual(["GLOBAL"]);
    expect(ev.source).toBe("endoflife");
    expect(ev.source_url).toBe("https://endoflife.date/python");
    expect(ev.external_ids).toEqual({ endoflife: "python" });
    expect(ev.confidence).toBe(0.9);
    expect(ev.featured).toBe(false);
    expect(ev.popularity).toBe(45);
    expect(ev.jsonld_eligible).toBe(false);
    expect(ev.image_candidate_url).toBeNull();
    expect(ev.raw).toEqual({ product: "python", release: "3.14", icon: "https://cdn.jsdelivr.net/npm/simple-icons/icons/python.svg" });
    expect(IngestEventSchema.safeParse(ev).success).toBe(true);
  });
  it("month-only values become month precision + tentative on the first of the month", () => {
    const py = product("python");
    const r = milestoneToEvent(py, { ...release(py, "3.14"), eolFrom: "2030-10" }, spec("eol"), NOW);
    const ev = (r as { event: ReturnType<typeof payloadToEvents>[number] }).event;
    expect(ev.date).toBe("2030-10-01");
    expect(ev.date_precision).toBe("month");
    expect(ev.status).toBe("tentative");
    expect(ev.slug).toBe("python-3-14-end-of-life-2030-10-01");
    expect(IngestEventSchema.safeParse(ev).success).toBe(true);
  });
  it("filters: absent, flagged, past, on the release day, far future, bad date, release label-year", () => {
    const py = product("python");
    const r314 = release(py, "3.14");
    expect(milestoneToEvent(py, { ...r314, eolFrom: null }, spec("eol"), NOW)).toBeNull();
    expect(milestoneToEvent(py, { ...r314, isEol: true }, spec("eol"), NOW)).toEqual({ reject: "flagged" });
    expect(milestoneToEvent(py, release(py, "3.8"), spec("eol"), NOW)).toEqual({ reject: "flagged" }); // isEol on the payload
    expect(milestoneToEvent(py, { ...r314, eolFrom: "2026-09-01" }, spec("eol"), NOW)).toEqual({ reject: "past" });
    const unreleased: EolRelease = { ...r314, name: "3.15", label: "3.15", releaseDate: "2026-10-07", eolFrom: "2031-10-31" };
    expect(milestoneToEvent(py, { ...unreleased, eoasFrom: "2026-10-07" }, spec("eoas"), NOW)).toEqual({ reject: "on-release-day" });
    expect(milestoneToEvent(py, { ...unreleased, ltsFrom: "2026-10-07" }, spec("lts"), NOW)).toEqual({ reject: "on-release-day" });
    // An eoas/eoes dated on the eol day is the eol countdown twice: the eol row alone carries it.
    expect(milestoneToEvent(py, { ...r314, eoasFrom: "2030-10-31" }, spec("eoas"), NOW)).toEqual({ reject: "same-as-eol" });
    expect(milestoneToEvent(py, { ...r314, eoesFrom: "2030-10-31" }, spec("eoes"), NOW)).toEqual({ reject: "same-as-eol" });
    expect(milestoneToEvent(py, { ...r314, eoasFrom: "2030-10-30" }, spec("eoas"), NOW)).toHaveProperty("event");
    expect(milestoneToEvent(py, unreleased, spec("release"), NOW)).toMatchObject({
      event: { title: "Python 3.15 release", source_key: "endoflife:python:3.15:release", date: "2026-10-07", popularity: 40 },
    });
    expect(milestoneToEvent(py, { ...r314, eolFrom: "2042-01-01" }, spec("eol"), NOW)).toEqual({ reject: "far-future" });
    expect(milestoneToEvent(py, { ...r314, eolFrom: "next year" }, spec("eol"), NOW)).toEqual({ reject: "bad-date" });
    const office: EolProduct = { name: "office", label: "Microsoft Office", links: { html: "https://endoflife.date/office" }, releases: [] };
    const future: EolRelease = { name: "2027", label: "2027", releaseDate: "2028-03-01", eolFrom: "2033-03-01" };
    expect(milestoneToEvent(office, future, spec("release"), NOW)).toEqual({ reject: "label-year" });
    expect(milestoneToEvent(office, { ...future, releaseDate: "2027-03-01" }, spec("release"), NOW)).toMatchObject({
      event: { title: "Microsoft Office 2027 release", source_key: "endoflife:office:2027:release", popularity: 40 },
    });
    // A version year in a non-release milestone is not a label-year violation.
    expect(milestoneToEvent(office, { ...future, releaseDate: "2027-03-01" }, spec("eol"), NOW)).toMatchObject({
      event: { title: "Microsoft Office 2027 end of life", date: "2033-03-01" },
    });
    // Yesterday is still kept (now − 2 d rule); the day before is not.
    expect(milestoneToEvent(py, { ...r314, eolFrom: "2026-09-08" }, spec("eol"), NOW)).toHaveProperty("event");
    expect(milestoneToEvent(py, { ...r314, eolFrom: "2026-09-06" }, spec("eol"), NOW)).toEqual({ reject: "past" });
    // … except for `release`: a cycle that shipped yesterday is no longer "scheduled for release".
    expect(milestoneToEvent(py, { ...unreleased, releaseDate: "2026-09-08" }, spec("release"), NOW)).toEqual({ reject: "past" });
    expect(milestoneToEvent(py, { ...unreleased, releaseDate: "2026-09-09" }, spec("release"), NOW)).toHaveProperty("event");
  });
});

describe("endoflife payload → rows", () => {
  it("emits only future milestones, sorted by source_key, all valid, stable across two calls", () => {
    const a = payloadToEvents(FIXTURE, NOW);
    const b = payloadToEvents(FIXTURE, NOW);
    expect(a.map((r) => r.source_key)).toEqual(b.map((r) => r.source_key));
    expect(a.map((r) => r.content_hash)).toEqual(b.map((r) => r.content_hash));
    expect(a.length).toBeGreaterThan(10);
    expect(a.length).toBeLessThanOrEqual(MAX_ROWS);
    const keys = a.map((r) => r.source_key);
    expect(keys).toEqual([...keys].sort());
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of a) {
      const parsed = IngestEventSchema.safeParse(r);
      expect(parsed.success, r.source_key).toBe(true);
      expect(r.date >= "2026-09-07", r.source_key).toBe(true);
      expect(r.category).toBe("tech");
      expect(r.all_day).toBe(true);
      expect(r.description.length).toBeGreaterThanOrEqual(80);
      expect(r.slug.startsWith("mine-") || r.slug.startsWith("share-")).toBe(false);
    }
    expect(keys).toContain("endoflife:python:3.14:eol");
    expect(keys).toContain("endoflife:ubuntu:26.04:eoes");
    expect(keys).not.toContain("endoflife:ubuntu:26.04:eoas"); // eoas dated on the eol day: rejected as same-as-eol, the eol row carries it
    expect(new Set(a.map((r) => r.slug)).size).toBe(a.length);
    expect(keys).toContain("endoflife:nodejs:26:lts");
    expect(keys).not.toContain("endoflife:python:3.8:eol"); // isEol, past
    expect(keys).not.toContain("endoflife:ubuntu:25.10:eol"); // isEol, past
    expect(keys.some((k) => k.endsWith(":release"))).toBe(false); // no unreleased cycles in the fixture
    const lts = a.find((r) => r.source_key === "endoflife:nodejs:26:lts")!;
    expect(lts.title).toBe("Node.js 26 LTS begins");
    expect(lts.date).toBe("2026-10-28");
    expect(lts.popularity).toBe(40);
    expect(lts.tags).toContain("lts");
  });
  it("'+' device variants and their base models get distinct slugs", () => {
    const tab: EolProduct = {
      name: "samsung-galaxy-tab",
      label: "Samsung Galaxy Tab",
      category: "device",
      links: { html: "https://endoflife.date/samsung-galaxy-tab" },
      releases: [
        { name: "galaxy-tab-a9+", label: "Galaxy Tab A9+", releaseDate: "2023-10-17", eoasFrom: "2027-10-23", eolFrom: "2028-10-23" },
        { name: "galaxy-tab-a9", label: "Galaxy Tab A9", releaseDate: "2023-10-17", eoasFrom: "2027-10-23", eolFrom: "2028-10-23" },
      ],
    };
    const rows = payloadToEvents({ schema_version: "1.2.1", result: [tab, ...FILLER] }, NOW);
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(rows.length);
    expect(rows.map((r) => r.slug).sort()).toEqual([
      "samsung-galaxy-tab-a9-end-of-active-support-2027-10-23",
      "samsung-galaxy-tab-a9-end-of-life-2028-10-23",
      "samsung-galaxy-tab-a9-plus-end-of-active-support-2027-10-23",
      "samsung-galaxy-tab-a9-plus-end-of-life-2028-10-23",
    ]);
    expect(rows.map((r) => r.source_key)).toEqual([
      "endoflife:samsung-galaxy-tab:galaxy-tab-a9+:eoas",
      "endoflife:samsung-galaxy-tab:galaxy-tab-a9+:eol",
      "endoflife:samsung-galaxy-tab:galaxy-tab-a9:eoas",
      "endoflife:samsung-galaxy-tab:galaxy-tab-a9:eol",
    ]);
    for (const r of rows) expect(IngestEventSchema.safeParse(r).success, r.source_key).toBe(true);
  });
  it("the single-product fixture parses and matches the same python rows", () => {
    const only = payloadToEvents(PYTHON, NOW);
    const full = payloadToEvents(FIXTURE, NOW).filter((r) => r.external_ids.endoflife === "python");
    expect(only.map((r) => r.source_key)).toEqual(full.map((r) => r.source_key));
    expect(only.map((r) => r.content_hash)).toEqual(full.map((r) => r.content_hash));
  });
  it("schema guard: 1.x accepted (drift logged), 2.x, non-array and too-small results rejected", () => {
    const warns: string[] = [];
    const log = { info() {}, warn: (m: string) => warns.push(m), error() {} };
    expect(assertSchema({ schema_version: "1.2.1", total: FILLER.length, result: FILLER }, log)).toHaveLength(FILLER.length);
    expect(warns).toHaveLength(0);
    expect(assertSchema({ schema_version: "1.3.0", result: [...FILLER, { nope: 1 }] }, log)).toHaveLength(FILLER.length);
    expect(warns).toEqual([expect.stringMatching(/schema_version 1\.3\.0/)]);
    // `total` disagreeing with the array length is logged, not fatal.
    expect(assertSchema({ schema_version: "1.2.1", total: 473, result: FILLER }, log)).toHaveLength(FILLER.length);
    expect(warns).toHaveLength(2);
    expect(warns[1]).toMatch(/total=473/);
    expect(() => assertSchema({ schema_version: "2.0.0", result: [] })).toThrow(/schema_version/);
    expect(() => assertSchema({ schema_version: "1.2.1", result: {} })).toThrow(/result/);
    expect(() => assertSchema({} as EolPayload)).toThrow(/schema_version/);
    // A degraded body (empty or truncated `result`) is an error, never an empty "ok" pass.
    expect(() => assertSchema({ schema_version: "1.2.1", result: [] })).toThrow(/products/);
    expect(() => assertSchema({ schema_version: "1.2.1", result: FILLER.slice(0, MIN_PRODUCTS - 1) })).toThrow(/only 199 products/);
    expect(() => payloadToEvents({ schema_version: "1.2.1", result: [] }, NOW)).toThrow(/products/);
  });
});

describe("endoflife cursor and units", () => {
  it("parseCursor accepts { fetchedOn, afterKey } and ignores foreign shapes", () => {
    expect(parseCursor(null)).toBeNull();
    expect(parseCursor({ afterKey: "x" })).toBeNull();
    expect(parseCursor({ fetchedOn: "2026-09-09" })).toEqual({ fetchedOn: "2026-09-09", afterKey: null });
    expect(parseCursor({ fetchedOn: "2026-09-09", afterKey: "endoflife:python:3.14:eol" })).toEqual({
      fetchedOn: "2026-09-09",
      afterKey: "endoflife:python:3.14:eol",
    });
    expect(parseCursor([1, 2])).toBeNull();
  });
  it("planUnits cuts key ranges; sliceUnit re-derives the same rows from a re-fetched (shifted) array", () => {
    const rows = payloadToEvents(FIXTURE, NOW);
    const units = planUnits(rows, "2026-09-09", null, 7);
    expect(units.length).toBe(Math.ceil(rows.length / 7));
    expect(units[0].afterKey).toBeNull();
    expect(units[0].after).toEqual({ fetchedOn: "2026-09-09", afterKey: rows[6].source_key });
    expect(units[1].afterKey).toBe(rows[6].source_key);
    expect(units.at(-1)!.toKey).toBe(rows.at(-1)!.source_key);
    const all = units.flatMap((u) => sliceUnit(rows, u).map((r) => r.source_key));
    expect(all).toEqual(rows.map((r) => r.source_key));
    // Resume after the first unit's cursor: the same remaining rows even if a row vanished meanwhile.
    const shifted = rows.filter((_, i) => i !== 8);
    const resumed = planUnits(shifted, "2026-09-10", (units[0].after as { afterKey: string }).afterKey, 7);
    expect(resumed[0].afterKey).toBe(rows[6].source_key);
    expect(sliceUnit(shifted, resumed[0]).map((r) => r.source_key)).toEqual(shifted.slice(7, 14).map((r) => r.source_key));
    expect(resumeIndex(rows, rows[3].source_key)).toBe(4);
    expect(resumeIndex(rows, "endoflife:zzz")).toBe(rows.length);
  });
  it("adapter: one fetch per pass shared by plan() and run(); rows valid; same keys on a second pass", async () => {
    const calls: string[] = [];
    const ctx = ctxFor(FIXTURE, calls);
    const plan = await adapter.plan(null, ctx);
    expect(plan.done).toBe(true);
    expect(plan.units.length).toBeGreaterThan(0);
    const rows = (await Promise.all(plan.units.map((u) => adapter.run(u, ctx)))).flat();
    expect(calls).toEqual([EOL_ENDPOINT]);
    for (const r of rows) expect(IngestEventSchema.safeParse(r).success, r.source_key).toBe(true);
    expect(rows.map((r) => r.source_key)).toEqual(payloadToEvents(FIXTURE, NOW).map((r) => r.source_key));
    // A later invocation (empty module state) resuming from the last cursor has nothing left to do.
    resetCache();
    const again = await adapter.plan(plan.units.at(-1)!.after, ctxFor(FIXTURE, calls));
    expect(again.units).toEqual([]);
    expect(calls).toHaveLength(2);
    // A fresh pass on a new day fetches again and yields the same keys.
    resetCache();
    const next = await adapter.plan(null, ctxFor(FIXTURE, calls, new Date("2026-09-10T12:00:00Z")));
    const nextRows = (await Promise.all(next.units.map((u) => adapter.run(u, ctxFor(FIXTURE, calls, new Date("2026-09-10T12:00:00Z")))))).flat();
    expect(nextRows.map((r) => r.source_key)).toEqual(rows.map((r) => r.source_key));
    expect(adapter.id).toBe("endoflife");
    expect(adapter.rank).toBe(5);
    expect(adapter.isConfigured()).toBe(true);
  });
  it("adapter.plan surfaces a schema break or a degraded payload as an error", async () => {
    await expect(adapter.plan(null, ctxFor({ schema_version: "2.0.0", result: [] }))).rejects.toThrow(/schema_version/);
    resetCache();
    await expect(adapter.plan(null, ctxFor({ schema_version: "1.2.1", result: [] }))).rejects.toThrow(/products/);
  });
});
