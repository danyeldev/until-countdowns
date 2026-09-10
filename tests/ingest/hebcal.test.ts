import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IngestEventSchema } from "@/lib/ingest/types";
import type { IngestContext } from "@/lib/ingest/types";
import { adapter, baseTitle, groupItems, hebcalUrl, itemsToEvents, normalizeMemo, parseLink, planUnits, type HebcalResponse } from "@/lib/ingest/sources/hebcal";

const NOW = new Date("2026-09-09T12:00:00Z");
const fixture = (name: string): HebcalResponse => JSON.parse(readFileSync(new URL(`../fixtures/hebcal/${name}`, import.meta.url), "utf8"));
const YEAR_2027 = fixture("2027.json");
const YEAR_2028_HEAD = fixture("2028-head.json");

function ctxFor(responses: Record<number, HebcalResponse>, calls: string[] = []): IngestContext {
  return {
    http: {
      fetchJson: async <T,>(url: string) => {
        calls.push(url);
        const year = Number(new URL(url).searchParams.get("year"));
        const body = responses[year];
        if (!body) throw new Error(`no fixture for ${url}`);
        return body as T;
      },
      fetchText: async () => "",
    },
    log: { info() {}, warn() {}, error() {} },
    now: NOW,
    budget: { remainingMs: () => 60_000 },
    dryRun: true,
  };
}

describe("hebcal helpers", () => {
  it("builds the documented query (whole year, no candles, no parashot, no special Shabbatot)", () => {
    const u = new URL(hebcalUrl(2030));
    expect(u.origin + u.pathname).toBe("https://www.hebcal.com/hebcal");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      v: "1",
      cfg: "json",
      maj: "on",
      min: "on",
      mod: "on",
      mf: "on",
      ss: "off",
      c: "off",
      s: "off",
      year: "2030",
      month: "x",
    });
  });
  it("parseLink extracts the holiday page id and its own start year, keeps the date in date-keyed ids, and drops tracking params", () => {
    expect(parseLink("https://hebcal.com/h/chanukah-2027?us=js&um=api")).toEqual({ id: "chanukah", year: 2027, slug: "chanukah-2027", url: "https://hebcal.com/h/chanukah-2027" });
    expect(parseLink("https://hebcal.com/h/rosh-hashana-labehemot-2040")).toEqual({
      id: "rosh-hashana-labehemot",
      year: 2040,
      slug: "rosh-hashana-labehemot-2040",
      url: "https://hebcal.com/h/rosh-hashana-labehemot-2040",
    });
    // Date-keyed page (an observance that can fall twice in one Gregorian year): the id keeps the date.
    expect(parseLink("https://hebcal.com/h/asara-btevet-20280109?us=js")).toEqual({
      id: "asara-btevet-20280109",
      year: 2028,
      slug: "asara-btevet-20280109",
      url: "https://hebcal.com/h/asara-btevet-20280109",
    });
    expect(parseLink("https://hebcal.com/holidays/")).toBeNull();
    expect(parseLink(undefined)).toBeNull();
    expect(parseLink("not a url")).toBeNull();
  });
  it("baseTitle strips day numerals, candle counts, CH''M markers, Hebrew years and the Erev prefix", () => {
    expect(baseTitle("Pesach VIII")).toEqual({ base: "Pesach", erev: false });
    expect(baseTitle("Pesach III (CH’’M)")).toEqual({ base: "Pesach", erev: false });
    expect(baseTitle("Sukkot VII (Hoshana Raba)")).toEqual({ base: "Sukkot", erev: false });
    expect(baseTitle("Chanukah: 1 Candle")).toEqual({ base: "Chanukah", erev: false });
    expect(baseTitle("Chanukah: 8 Candles")).toEqual({ base: "Chanukah", erev: false });
    expect(baseTitle("Chanukah: 8th Day")).toEqual({ base: "Chanukah", erev: false });
    expect(baseTitle("Rosh Hashana 5788")).toEqual({ base: "Rosh Hashana", erev: false });
    expect(baseTitle("Erev Yom Kippur")).toEqual({ base: "Yom Kippur", erev: true });
    expect(baseTitle("Yom HaAtzma’ut")).toEqual({ base: "Yom HaAtzma’ut", erev: false });
    expect(baseTitle("Purim Katan")).toEqual({ base: "Purim Katan", erev: false });
  });
  it("normalizeMemo adds the terminal period and counts sentences", () => {
    expect(normalizeMemo("Fast of Esther")).toEqual({ text: "Fast of Esther.", sentences: 1 });
    expect(normalizeMemo("The Jewish New Year. Also spelled Rosh Hashanah")).toEqual({ text: "The Jewish New Year. Also spelled Rosh Hashanah.", sentences: 2 });
    expect(normalizeMemo("  ")).toEqual({ text: "", sentences: 0 });
  });
});

describe("hebcal fixture → rows", () => {
  const rows = itemsToEvents(YEAR_2027.items ?? [], 2027, NOW);
  const byKey = new Map(rows.map((r) => [r.source_key, r]));

  it("every row validates, has source hebcal, category religion, day precision, scheduled, confidence 1, no year in the title", () => {
    // Full live 2027 response (59 holiday items) plus one roshchodesh item: every holiday page shape is covered.
    expect((YEAR_2027.items ?? []).length).toBe(60);
    expect(rows.length).toBeGreaterThanOrEqual(30);
    for (const r of rows) {
      const parsed = IngestEventSchema.safeParse(r);
      expect(parsed.success, `${r.slug}: ${JSON.stringify(parsed.success ? null : parsed.error.issues)}`).toBe(true);
      expect(r.source).toBe("hebcal");
      expect(r.category).toBe("religion");
      expect(r.date_precision).toBe("day");
      expect(r.status).toBe("scheduled");
      expect(r.confidence).toBe(1);
      expect(r.all_day).toBe(true);
      expect(r.timezone).toBeNull();
      expect(r.jsonld_eligible).toBe(false);
      expect(r.series_slug).toBeNull();
      expect(/\b\d{4}\b/.test(r.title), r.title).toBe(false);
      expect(r.tags).toEqual(expect.arrayContaining(["jewish", "hebcal", "holiday"]));
      expect(r.source_url).not.toBeNull();
      expect(r.source_url).toMatch(/^https:\/\/hebcal\.com\/h\/[a-z0-9-]+-2027(\d{4})?$/);
      expect(r.external_ids).toEqual({ hebcal: expect.stringMatching(/^(erev-)?[a-z0-9-]+-2027(\d{4})?$/) });
      expect(r.description.length).toBeGreaterThanOrEqual(80);
      expect((r.description.match(/[.!?](?=\s|$)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    }
    expect(new Set(rows.map((r) => r.source_key)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(rows.length);
  });
  it("is deterministic: two calls give identical rows and source_keys", () => {
    const again = itemsToEvents(YEAR_2027.items ?? [], 2027, NOW);
    expect(again.map((r) => r.source_key)).toEqual(rows.map((r) => r.source_key));
    expect(again).toEqual(rows);
    expect(rows.map((r) => r.source_key)).toMatchSnapshot();
  });
  it("groups Pesach I..VIII into one featured Passover row keyed by the Hebcal page id", () => {
    const p = byKey.get("hebcal:2027:pesach")!;
    expect(p).toBeDefined();
    expect(p.title).toBe("Passover");
    expect(p.slug).toBe("passover-2027-04-22");
    expect(p.date).toBe("2027-04-22");
    expect(p.end_date).toBe("2027-04-29");
    expect(p.featured).toBe(true);
    expect(p.popularity).toBe(55);
    expect(p.tags).toContain("major");
    expect(p.regions).toEqual(["GLOBAL"]);
    expect(p.external_ids).toEqual({ hebcal: "pesach-2027" });
    expect(p.source_url).toBe("https://hebcal.com/h/pesach-2027");
    expect(p.description).toContain("Feast of Unleavened Bread");
    expect(p.description).toContain("April 22, 2027 to April 29, 2027");
    expect(rows.filter((r) => r.title === "Passover")).toHaveLength(1);
  });
  it("Erev items become separate '<Name> Eve' rows with popularity 20 and no featured flag", () => {
    const e = byKey.get("hebcal:2027:erev-pesach")!;
    expect(e.title).toBe("Passover Eve");
    expect(e.slug).toBe("passover-eve-2027-04-21");
    expect(e.date).toBe("2027-04-21");
    expect(e.end_date).toBeNull();
    expect(e.featured).toBe(false);
    expect(e.popularity).toBe(20);
    expect(e.tags).toContain("erev");
    expect(e.description).toContain("Passover begins at sundown");
    expect(byKey.get("hebcal:2027:erev-yom-kippur")!.title).toBe("Yom Kippur Eve");
    expect(byKey.get("hebcal:2027:erev-rosh-hashana")!.title).toBe("Rosh Hashanah Eve");
  });
  it("Rosh Hashana 5788 + II → 'Rosh Hashanah' without the Hebrew year, two days, featured", () => {
    const r = byKey.get("hebcal:2027:rosh-hashana")!;
    expect(r.title).toBe("Rosh Hashanah");
    expect(r.date).toBe("2027-10-02");
    expect(r.end_date).toBe("2027-10-03");
    expect(r.featured).toBe(true);
    expect(r.raw).toMatchObject({ items: [{ title: "Rosh Hashana 5788", hdate: "1 Tishrei 5788", yomtov: true }, { title: "Rosh Hashana II" }] });
  });
  it("Hanukkah: eight candle items → one row ending eight days after the first candle (into the next year)", () => {
    const h = byKey.get("hebcal:2027:chanukah")!;
    expect(h.title).toBe("Hanukkah");
    expect(h.date).toBe("2027-12-24");
    expect(h.end_date).toBe("2028-01-01");
    expect(h.featured).toBe(true);
    // `date` is the first-candle evening, so the generic "previous evening" sentence would be a day off.
    expect(h.description).toContain("first candle is lit at nightfall on December 24, 2027");
    expect(h.description).toContain("eighth day falls on January 1, 2028");
    expect(h.description).not.toContain("previous evening");
    expect(rows.filter((r) => /hanukkah|chanukah/i.test(r.title))).toHaveLength(1);
    // Chag HaBanot sits between the candle days but has its own page: separate row, minor.
    const banot = byKey.get("hebcal:2027:chag-habanot")!;
    expect(banot.date).toBe("2027-12-30");
    expect(banot.popularity).toBe(30);
  });
  it("the 'Chanukah: 8th Day' spill-over on 1 January is skipped in the next year's unit; the same-year 8th Day is not double counted", () => {
    const rows28 = itemsToEvents(YEAR_2028_HEAD.items ?? [], 2028, NOW);
    expect(rows28.some((r) => r.source_key === "hebcal:2027:chanukah")).toBe(false);
    const h28 = rows28.find((r) => r.source_key === "hebcal:2028:chanukah")!;
    expect(h28.date).toBe("2028-12-12");
    expect(h28.end_date).toBe("2028-12-20");
    expect(rows28.find((r) => r.source_key === "hebcal:2028:rosh-hashana")!.title).toBe("Rosh Hashanah");
    const g = groupItems(YEAR_2028_HEAD.items ?? [], 2028);
    expect(g.some((x) => x.id === "chanukah" && x.year === 2027)).toBe(false);
  });
  it("Asara B'Tevet falls twice in 2028: date-keyed pages give two separate single-day rows with their own URLs", () => {
    const rows28 = itemsToEvents(YEAR_2028_HEAD.items ?? [], 2028, NOW);
    const asara = rows28.filter((r) => /asara/i.test(r.title));
    expect(asara.map((r) => r.source_key)).toEqual(["hebcal:2028:asara-btevet-20280109", "hebcal:2028:asara-btevet-20281228"]);
    expect(asara.map((r) => r.date)).toEqual(["2028-01-09", "2028-12-28"]);
    expect(asara.map((r) => r.end_date)).toEqual([null, null]);
    expect(asara.map((r) => r.slug)).toEqual(["asara-b-tevet-2028-01-09", "asara-b-tevet-2028-12-28"]);
    expect(asara.map((r) => r.source_url)).toEqual(["https://hebcal.com/h/asara-btevet-20280109", "https://hebcal.com/h/asara-btevet-20281228"]);
    expect(asara.map((r) => r.external_ids)).toEqual([{ hebcal: "asara-btevet-20280109" }, { hebcal: "asara-btevet-20281228" }]);
    for (const r of asara) {
      expect(r.popularity).toBe(25);
      expect(r.tags).toContain("fast");
      expect(r.description).toBe("Fast commemorating the siege of Jerusalem. Observance begins at sundown the previous evening.");
    }
    expect(rows28.some((r) => r.source_key === "hebcal:2028:asara-b-tevet")).toBe(false);
  });
  it("guard: link-less same-title items more than a day apart start a separate date-keyed row instead of one year-long row", () => {
    const warned: string[] = [];
    const log = { info() {}, warn: (m: string) => warned.push(m), error() {} };
    const items = [
      { title: "Twice Fast", date: "2028-01-09", category: "holiday", subcat: "fast", memo: "A fast that falls twice this year" },
      { title: "Twice Fast", date: "2028-12-28", category: "holiday", subcat: "fast", memo: "A fast that falls twice this year" },
    ];
    const rows = itemsToEvents(items, 2028, NOW, log);
    expect(rows.map((r) => [r.source_key, r.date, r.end_date])).toEqual([
      ["hebcal:2028:twice-fast", "2028-01-09", null],
      ["hebcal:2028:twice-fast-20281228", "2028-12-28", null],
    ]);
    expect(rows.map((r) => r.source_url)).toEqual([null, null]);
    expect(rows.map((r) => r.external_ids)).toEqual([{}, {}]);
    expect(warned.some((m) => /starting a separate row/.test(m))).toBe(true);
    // Consecutive days still merge into one row (no warning).
    const consecutive = itemsToEvents(
      [
        { title: "Two Days I", date: "2028-03-01", category: "holiday", subcat: "minor" },
        { title: "Two Days II", date: "2028-03-02", category: "holiday", subcat: "minor" },
      ],
      2028,
      NOW,
    );
    expect(consecutive.map((r) => [r.source_key, r.date, r.end_date])).toEqual([["hebcal:2028:two-days", "2028-03-01", "2028-03-02"]]);
  });
  it("a missing subcat defaults to minor (popularity 30), never to major", () => {
    const rows = itemsToEvents([{ title: "Mystery Day", date: "2028-06-01", category: "holiday", link: "https://hebcal.com/h/mystery-day-2028" }], 2028, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].popularity).toBe(30);
    expect(rows[0].tags).toContain("minor");
    expect(rows[0].tags).not.toContain("major");
    expect(rows[0].featured).toBe(false);
  });
  it("subcat mapping: modern → IL region + israel tag + 35; fast → 25; minor → 30; Yom Kippur single day featured 55", () => {
    const modern = byKey.get("hebcal:2027:yom-haatzmaut")!;
    expect(modern.regions).toEqual(["GLOBAL", "IL"]);
    expect(modern.tags).toEqual(expect.arrayContaining(["modern", "israel"]));
    expect(modern.popularity).toBe(35);
    expect(modern.featured).toBe(false);
    const fast = byKey.get("hebcal:2027:tzom-gedaliah")!;
    expect(fast.popularity).toBe(25);
    expect(fast.tags).toContain("fast");
    expect(fast.regions).toEqual(["GLOBAL"]);
    const minor = byKey.get("hebcal:2027:tu-bishvat")!;
    expect(minor.popularity).toBe(30);
    expect(minor.description.length).toBeGreaterThanOrEqual(80);
    // Two-sentence memo of 80+ characters: used as-is. Shorter or one-sentence memos: the sundown sentence is appended.
    expect(minor.description).toBe("New Year for Trees. Tu BiShvat is one of four “New Years” mentioned in the Mishnah.");
    expect(fast.description).toBe("Fast of the Seventh Month. Commemorates the assassination of the Jewish governor of Judah.");
    // A very short memo also gets the date sentence so the row clears the 80-character bar.
    expect(byKey.get("hebcal:2027:taanit-esther")!.description).toBe(
      "Fast of Esther. Observance begins at sundown the previous evening. In 2027 it falls on March 22, 2027.",
    );
    const tisha = byKey.get("hebcal:2027:tisha-bav")!;
    expect(tisha.title).toBe("Tisha B'Av");
    expect(tisha.popularity).toBe(55);
    expect(tisha.description).toBe(
      "The Ninth of Av. Fast commemorating the destruction of the two Temples. Observance begins at sundown the previous evening.",
    );
    expect(byKey.get("hebcal:2027:yom-hashoah")!.description).toBe(
      "Holocaust Memorial Day. Observance begins at sundown the previous evening. In 2027 it falls on May 4, 2027.",
    );
    expect(byKey.get("hebcal:2027:yom-yerushalayim")!.description).toBe(
      "Jerusalem Day. Commemorates the re-unification of Jerusalem in 1967. Observance begins at sundown the previous evening.",
    );
    // Diaspora calendar: Shavuot is two days.
    const shavuot = byKey.get("hebcal:2027:shavuot")!;
    expect(shavuot.date).toBe("2027-06-11");
    expect(shavuot.end_date).toBe("2027-06-12");
    const erevShavuot = byKey.get("hebcal:2027:erev-shavuot")!;
    expect(erevShavuot.title).toBe("Shavuot Eve");
    expect(erevShavuot.date).toBe("2027-06-10");
    expect(erevShavuot.external_ids).toEqual({ hebcal: "erev-shavuot-2027" });
    const yk = byKey.get("hebcal:2027:yom-kippur")!;
    expect(yk.end_date).toBeNull();
    expect(yk.featured).toBe(true);
    expect(yk.popularity).toBe(55);
  });
  it("filters: non-holiday categories, items outside the requested year, and past dates", () => {
    expect(rows.some((r) => /rosh chodesh/i.test(r.title))).toBe(false);
    const warned: string[] = [];
    const log = { info() {}, warn: (m: string) => warned.push(m), error() {} };
    const items = [...(YEAR_2027.items ?? []), { title: "Stray", date: "2026-05-01", category: "holiday", subcat: "minor", link: "https://hebcal.com/h/stray-2026" }];
    const withStray = itemsToEvents(items, 2027, NOW, log);
    expect(withStray.map((r) => r.source_key)).toEqual(rows.map((r) => r.source_key));
    expect(warned.some((m) => /outside the requested year/.test(m))).toBe(true);
    const later = itemsToEvents(YEAR_2027.items ?? [], 2027, new Date("2027-06-01T00:00:00Z"));
    expect(later.some((r) => r.source_key === "hebcal:2027:pesach")).toBe(false);
    expect(later.some((r) => r.source_key === "hebcal:2027:erev-pesach")).toBe(false);
    expect(later.some((r) => r.source_key === "hebcal:2027:rosh-hashana")).toBe(true);
    // A multi-day holiday is kept while in progress: Passover (Apr 22-29) is still a row on Apr 27,
    // and even two days after its end (isFutureOrFar's 2-day grace); its Eve row is already gone.
    const during = itemsToEvents(YEAR_2027.items ?? [], 2027, new Date("2027-04-27T00:00:00Z"));
    expect(during.some((r) => r.source_key === "hebcal:2027:pesach")).toBe(true);
    expect(during.some((r) => r.source_key === "hebcal:2027:erev-pesach")).toBe(false);
    const eve = itemsToEvents(YEAR_2027.items ?? [], 2027, new Date("2027-04-30T12:00:00Z"));
    expect(eve.some((r) => r.source_key === "hebcal:2027:pesach")).toBe(true);
    expect(itemsToEvents(YEAR_2027.items ?? [], 2027, new Date("2027-05-01T12:00:00Z")).some((r) => r.source_key === "hebcal:2027:pesach")).toBe(false);
  });
});

describe("hebcal adapter plan/run", () => {
  it("plans one unit per year for 15 years with a content-addressed cursor, resuming after the last upserted year", async () => {
    const units = planUnits(NOW, null);
    expect(units).toHaveLength(15);
    expect(units[0]).toMatchObject({ key: "hebcal:2026", year: 2026, after: { afterYear: 2026 } });
    expect(units[14]).toMatchObject({ key: "hebcal:2040", year: 2040, after: { afterYear: 2040 } });
    expect(planUnits(NOW, { afterYear: 2030 }).map((u) => u.year)).toEqual([2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040]);
    expect(planUnits(NOW, { afterYear: 2040 })).toEqual([]);
    // A cursor left over from a pass that started in an earlier year restarts at this year.
    expect(planUnits(NOW, { afterYear: 2020 })[0].year).toBe(2026);
    expect(planUnits(NOW, { year: 2027, next: 3 })[0].year).toBe(2026);
    const plan = await adapter.plan(null, ctxFor({}));
    expect(plan.done).toBe(true);
    expect(plan.units.map((u) => u.key)).toEqual(units.map((u) => u.key));
  });
  it("run() fetches the unit's year once and returns the fixture's rows; identical across two calls", async () => {
    const calls: string[] = [];
    const ctx = ctxFor({ 2027: YEAR_2027 }, calls);
    const unit = planUnits(NOW, { afterYear: 2026 })[0];
    expect(unit.year).toBe(2027);
    const a = await adapter.run(unit, ctx);
    const b = await adapter.run(unit, ctx);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toBe(hebcalUrl(2027));
    expect(a.map((r) => r.source_key)).toEqual(b.map((r) => r.source_key));
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(30);
    expect(adapter.id).toBe("hebcal");
    expect(adapter.rank).toBe(5);
    expect(adapter.limits.minIntervalMs).toBe(1000);
    expect(adapter.isConfigured()).toBe(true);
  });
});
