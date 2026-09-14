import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/ingest/http";
import { adapter, F1CALENDAR_BASE, planUnits, racesToEvents, sessionDate, type F1Race } from "@/lib/ingest/sources/f1calendar";
import { IngestEventSchema, type IngestContext } from "@/lib/ingest/types";

const NOW = new Date("2026-09-14T12:00:00Z");
const fixture = JSON.parse(readFileSync(new URL("../fixtures/f1calendar/2026-sample.json", import.meta.url), "utf8")) as { races: F1Race[] };

function context(body: unknown = fixture): IngestContext {
  return {
    http: { fetchJson: async <T,>() => body as T, fetchText: async () => "" },
    now: NOW,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    budget: { remainingMs: () => 60_000 },
    dryRun: true,
  };
}

describe("F1Calendar session dates", () => {
  it("accepts actual instants and date-only schedules without inventing times", () => {
    expect(sessionDate("2026-11-22T04:00:00Z", 2026)).toBe("2026-11-22T04:00:00Z");
    expect(sessionDate("2026-11-22", 2026)).toBe("2026-11-22");
    expect(sessionDate("2028-02-29T04:00:00Z", 2028)).toBe("2028-02-29T04:00:00Z");
  });

  it.each(["2026-02-30", "2026-02-29T04:00:00Z", "2026-11-22T04:00:00", "2026-11-22T24:00:00Z", "2026-11-22T04:00:60Z", "2027-11-22", "TBC", null, 123])("rejects impossible or unconfirmed date %s", (value) => {
    expect(sessionDate(value, 2026)).toBeNull();
  });
});

describe("F1Calendar events", () => {
  it("maps a recorded schedule to valid GP/sprint events, with sources and no fabricated images", () => {
    const rows = racesToEvents(fixture.races, 2026, NOW);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(IngestEventSchema.safeParse(row).success).toBe(true);
      expect(row.source).toBe("f1calendar");
      expect(row.category).toBe("sports");
      expect(row.summary).toBe(row.description);
      expect(row.source_url).toContain("/blob/main/_db/f1/2026.json");
      expect(row.date_precision).toBe("instant");
      expect(row.image_candidate_url).toBeNull();
      expect(row.tags).toContain("formula-1");
      expect(row.jsonld_eligible).toBe(true);
    }
    expect(rows.filter((row) => row.tags.includes("sprint"))).toHaveLength(1);
    expect(rows.some((row) => row.title.includes("Qualifying"))).toBe(false);
  });

  it("keeps Las Vegas on Saturday in the venue zone although its timestamp is Sunday UTC", () => {
    const row = racesToEvents(fixture.races, 2026, NOW).find((item) => item.title.includes("Las Vegas"))!;
    expect(row.date).toBe("2026-11-22T04:00:00Z");
    expect(row.timezone).toBe("America/Los_Angeles");
    expect(row.slug).toBe("2026-las-vegas-grand-prix-2026-11-21");
    expect(row.location).toEqual({ name: "Las Vegas", city: "Las Vegas", country: "US" });
    expect(row.regions).toEqual(["GLOBAL", "US"]);
  });

  it("uses Malaysia for the relocated Bahrain race and avoids repeating Grand Prix", () => {
    const row = racesToEvents(fixture.races, 2026, NOW).find((item) => item.title.includes("Bahrain"))!;
    expect(row.title).toBe("2026 Bahrain Grand Prix (Malaysia)");
    expect(row.timezone).toBe("Asia/Kuala_Lumpur");
    expect(row.regions).toContain("MY");
  });

  it("preserves identity when a session is rescheduled and deduplicates repeated entries", () => {
    const original = fixture.races.find((race) => race.slug === "las-vegas-grand-prix")!;
    const moved = { ...original, sessions: { gp: "2026-11-22T05:00:00Z" } };
    const rows = racesToEvents([original, moved], 2026, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].source_key).toBe("f1calendar:2026:las-vegas-grand-prix:gp");
    expect(rows[0].date).toBe("2026-11-22T05:00:00Z");
    expect(rows[0].content_hash).not.toBe(racesToEvents([original], 2026, NOW)[0].content_hash);
  });

  it("filters past sessions, invalid dates and malformed identity while retaining unknown venues", () => {
    const base: F1Race = { name: "New Circuit", slug: "new-grand-prix", sessions: { gp: "2026-12-08" } };
    const rows = racesToEvents([
      base,
      { ...base, slug: "past", sessions: { gp: "2026-09-14T10:00:00Z" } },
      { ...base, slug: "invalid", sessions: { gp: "2026-02-30" } },
      { ...base, slug: "../escape" },
      { ...base, name: "" },
      { ...base, sessions: {} },
    ], 2026, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].date_precision).toBe("day");
    expect(rows[0].all_day).toBe(true);
    expect(rows[0].timezone).toBeNull();
    expect(rows[0].location).toBeNull();
    expect(rows[0].jsonld_eligible).toBe(false);
    expect(rows[0].regions).toEqual(["GLOBAL"]);
    expect(rows[0].description).toContain("start time has not been confirmed");
  });
});

describe("F1Calendar resumable adapter", () => {
  it("plans two seasons, resumes after a completed year and restarts exhausted cursors", () => {
    expect(planUnits(null, NOW).units.map((unit) => unit.year)).toEqual([2026, 2027]);
    expect(planUnits({ afterYear: 2026 }, NOW).units.map((unit) => unit.year)).toEqual([2027]);
    expect(planUnits({ afterYear: 2027 }, NOW).units.map((unit) => unit.year)).toEqual([2026, 2027]);
    expect(planUnits({ afterYear: "invalid" }, NOW).units).toHaveLength(2);
  });

  it("reads a fixed upstream host and treats only an unpublished future season as optional", async () => {
    const ctx = context();
    const fetchJson = vi.spyOn(ctx.http, "fetchJson");
    const plan = await adapter.plan(null, ctx);
    expect(await adapter.run(plan.units[0], ctx)).toHaveLength(5);
    expect(fetchJson).toHaveBeenCalledWith(`${F1CALENDAR_BASE}/2026.json`);
    ctx.http.fetchJson = vi.fn().mockRejectedValue(new HttpError(404, "calendar"));
    await expect(adapter.run(plan.units[1], ctx)).resolves.toEqual([]);
    await expect(adapter.run(plan.units[0], ctx)).rejects.toThrow("HTTP 404");
    ctx.http.fetchJson = vi.fn().mockRejectedValue(new HttpError(429, "calendar"));
    await expect(adapter.run(plan.units[1], ctx)).rejects.toThrow("HTTP 429");
  });

  it.each([null, {}, { races: null }, { races: [] }, { races: "unavailable" }, { races: [{ error: "nope" }] }])("fails a malformed success response instead of completing a destructive empty pass: %j", async (body) => {
    const ctx = context(body);
    await expect(adapter.run((await adapter.plan(null, ctx)).units[0], ctx)).rejects.toThrow("Invalid F1Calendar");
  });
});
