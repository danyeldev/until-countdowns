import { describe, expect, it } from "vitest";
import {
  eventHeat,
  pickHomeHighlights,
  pickHottest,
  pickHottestFamilies,
  type HeatEvent,
} from "@/lib/heat";

function event(partial: Partial<HeatEvent> & Pick<HeatEvent, "id">): HeatEvent {
  return {
    title: partial.title ?? partial.id,
    date: "2026-10-31",
    category: "holidays",
    popularity: 50,
    featured: false,
    daysUntil: 30,
    hype: 0,
    ...partial,
  };
}

describe("eventHeat", () => {
  it("rewards approaching dates over equal far ones", () => {
    const soon = eventHeat({ popularity: 50, featured: false, daysUntil: 6, hype: 0 });
    const later = eventHeat({ popularity: 50, featured: false, daysUntil: 90, hype: 0 });
    expect(soon).toBeGreaterThan(later + 10);
  });

  it("lets live hype beat an obscure date tomorrow", () => {
    const pickle = eventHeat({ popularity: 15, featured: false, daysUntil: 0, hype: 0 });
    const premiere = eventHeat({ popularity: 40, featured: false, daysUntil: 10, hype: 40 });
    expect(premiere).toBeGreaterThan(pickle);
  });

  it("keeps a far featured marquee in the mix", () => {
    const bowl = eventHeat({ popularity: 95, featured: true, daysUntil: 160, hype: 0 });
    const filler = eventHeat({ popularity: 20, featured: false, daysUntil: 20, hype: 0 });
    expect(bowl).toBeGreaterThan(filler);
  });

  it("log-scales hype so a double score is not a double rank", () => {
    const mid = eventHeat({ popularity: 50, featured: false, daysUntil: 30, hype: 40 });
    const high = eventHeat({ popularity: 50, featured: false, daysUntil: 30, hype: 80 });
    const spike = eventHeat({ popularity: 50, featured: false, daysUntil: 30, hype: 240 });
    expect(high - mid).toBeGreaterThan(spike - high);
  });

  it("treats a missing day count as mid-horizon, not today", () => {
    const coarse = eventHeat({ popularity: 80, featured: true, hype: 0 });
    const today = eventHeat({ popularity: 80, featured: true, daysUntil: 0, hype: 0 });
    expect(today).toBeGreaterThan(coarse);
  });
});

describe("home blender", () => {
  it("picks the hottest row first, then spreads category and day", () => {
    const pool = [
      event({ id: "a", category: "tv", daysUntil: 5, hype: 80, popularity: 40, date: "2026-09-21" }),
      event({ id: "b", category: "tv", daysUntil: 6, hype: 60, popularity: 38, date: "2026-09-21" }),
      event({ id: "c", category: "sports", daysUntil: 12, hype: 20, popularity: 70, date: "2026-09-28" }),
      event({ id: "d", category: "space", daysUntil: 20, hype: 10, popularity: 85, featured: true, date: "2026-10-06" }),
      event({ id: "e", category: "holidays", daysUntil: 44, hype: 2, popularity: 80, featured: true, date: "2026-10-31" }),
    ];
    const picked = pickHomeHighlights(pool, 4);
    expect(picked[0].id).toBe("d");
    expect(picked.map((row) => row.id).sort()).toEqual(["a", "c", "d", "e"]);
    expect(new Set(picked.map((row) => row.category)).size).toBe(4);
  });

  it("keeps two strong events on the same day when categories differ", () => {
    const pool = [
      event({
        id: "ind",
        title: "Independence Day",
        category: "national",
        featured: true,
        popularity: 86,
        daysUntil: 0,
        date: "2026-09-16",
      }),
      event({
        id: "blood",
        title: "City of Blood",
        category: "tv",
        popularity: 32,
        hype: 27,
        daysUntil: 0,
        date: "2026-09-16",
      }),
      event({
        id: "games",
        title: "Asian Games",
        category: "sports",
        featured: true,
        popularity: 78,
        hype: 11,
        daysUntil: 3,
        date: "2026-09-19",
      }),
    ];
    expect(pickHomeHighlights(pool, 3).map((row) => row.id).sort()).toEqual([
      "blood",
      "games",
      "ind",
    ]);
  });

  it("collapses the same title when series slugs differ", () => {
    const pool = [
      event({
        id: "us",
        title: "Independence Day",
        category: "national",
        daysUntil: 0,
        popularity: 86,
        featured: true,
        date: "2026-09-16",
      }),
      event({
        id: "mx",
        title: "Independence Day",
        category: "national",
        daysUntil: 0,
        popularity: 78,
        featured: true,
        date: "2026-09-16",
      }),
      event({
        id: "ok",
        title: "Oktoberfest",
        category: "festivals",
        daysUntil: 3,
        popularity: 74,
        featured: true,
        date: "2026-09-19",
      }),
    ];
    expect(pickHomeHighlights(pool, 2).map((row) => row.id)).toEqual(["us", "ok"]);
  });

  it("does not repeat a series while others remain", () => {
    const pool = [
      event({ id: "h1", seriesSlug: "halloween", daysUntil: 40, popularity: 80, featured: true, hype: 10 }),
      event({ id: "h2", seriesSlug: "halloween", daysUntil: 405, popularity: 80, featured: true }),
      event({ id: "x", category: "music", daysUntil: 18, popularity: 55, hype: 12, date: "2026-10-04" }),
    ];
    expect(pickHomeHighlights(pool, 2).map((row) => row.id)).toEqual(["h1", "x"]);
  });

  it("keeps one title in a week table", () => {
    const pool = [
      event({
        id: "mx",
        title: "Independence Day",
        popularity: 86,
        featured: true,
        daysUntil: 0,
        date: "2026-09-16",
      }),
      event({
        id: "cl",
        title: "Independence Day",
        popularity: 78,
        featured: true,
        daysUntil: 3,
        date: "2026-09-19",
      }),
      event({
        id: "blood",
        title: "City of Blood series premiere",
        category: "tv",
        popularity: 32,
        daysUntil: 0,
        hype: 27,
        date: "2026-09-16",
      }),
    ];
    expect(pickHottestFamilies(pool, 2).map((row) => row.id)).toEqual(["mx", "blood"]);
  });

  it("takes the hottest N for a week table", () => {
    const pool = [
      event({ id: "low", popularity: 20, daysUntil: 2, hype: 0 }),
      event({ id: "hot", popularity: 35, daysUntil: 3, hype: 30 }),
      event({ id: "mid", popularity: 60, daysUntil: 4, hype: 0 }),
    ];
    expect(pickHottest(pool, 2).map((row) => row.id)).toEqual(["hot", "mid"]);
  });
});
