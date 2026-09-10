import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { candidateToEvent, cleanCandidate, extractCandidates } from "@/lib/ingest/sources/wikipedia";

const NOW = new Date("2026-09-09T12:00:00Z");
const html = readFileSync(new URL("../fixtures/wikipedia/2027-snippet.html", import.meta.url), "utf8");

describe("wikipedia year page parser", () => {
  const candidates = extractCandidates(html, 2027);
  const titles = candidates.map((c) => c.title);

  it("keeps clean, name-like titles and drops forecasts, lowercase, short, long and nested items", () => {
    expect(titles).toContain("CES 2027");
    expect(titles).toContain("Super Bowl LXI");
    expect(titles).toContain("99th Academy Awards");
    expect(titles).not.toContain("French presidential election, first round"); // one capitalised word only
    expect(titles).toContain("FIFA Women's World Cup");
    expect(titles).toContain("United States 251st Independence Day celebrations");
    expect(titles).toContain("German Unity Day & 37th anniversary of reunification");
    expect(titles).toContain("Election Day (United States)");
    expect(titles).toContain("Nobel Prize ceremony in Stockholm");
    expect(titles.some((t) => /expected|will be|scheduled/i.test(t))).toBe(false);
    expect(titles.some((t) => /^the lowercase/.test(t))).toBe(false);
    expect(titles.some((t) => t === "Short")).toBe(false);
    expect(titles.some((t) => t.length > 90)).toBe(false);
    expect(titles.some((t) => /Nested Sub Item/.test(t))).toBe(false);
    expect(titles.some((t) => /Something without a day/.test(t))).toBe(false);
    expect(titles.some((t) => /Another sentence/.test(t))).toBe(false);
    expect(titles.some((t) => /[<>\[\]]|&amp;|&#/.test(t))).toBe(false);
  });
  it("assigns dates from the month/day prefix", () => {
    expect(candidates.find((c) => c.title.startsWith("CES 2027"))?.date).toBe("2027-01-06");
    expect(candidates.find((c) => c.title.startsWith("CES 2027"))?.endDate).toBe("2027-01-09");
    expect(candidates.find((c) => c.title.startsWith("Nobel"))?.date).toBe("2027-12-10");
  });
  it("cleanCandidate rules", () => {
    expect(cleanCandidate("Bulgaria is expected to join the Schengen Area")).toBeNull();
    expect(cleanCandidate("something Lowercase Start")).toBeNull();
    expect(cleanCandidate("Only one capital here")).toBeNull();
    expect(cleanCandidate("Grand Prix of Monaco. Second sentence.")).toBe("Grand Prix of Monaco");
    expect(cleanCandidate("The 2027 AFC Asian Cup is scheduled to be held in Saudi Arabia, across Riyadh, Jeddah and Al Khobar.")).toBe("2027 AFC Asian Cup");
    expect(cleanCandidate("International Horticultural Expo 2027, also known as GREEN×EXPO 2027, will be held in Yokohama")).toBe("International Horticultural Expo 2027");
    expect(cleanCandidate("Expo 2027 will be held in Belgrade, Serbia")).toBe("Expo 2027");
    expect(cleanCandidate("If not triggered earlier, the next Estonian parliamentary election must be held no later than this date.")).toBeNull();
    expect(cleanCandidate("The 71st Eurovision Song Contest will be held at Arena Burgas in Burgas, Bulgaria.")).toBe("71st Eurovision Song Contest");
    expect(cleanCandidate("Tokyo Marathon<sup class=\"reference\">[9]</sup> &amp; more")).toBe("Tokyo Marathon & more");
    // Capitalised name parts that coincide with a verb are not cut points (verbs in prose are lowercase).
    expect(cleanCandidate("World's End Day festival")).toBe("World's End Day festival");
    expect(cleanCandidate("Eurovision Song Contest, May 15 Final Show")).toBe("Eurovision Song Contest, May 15 Final Show");
    expect(cleanCandidate("Marks & Spencer Centenary Exhibition")).toBe("Marks & Spencer Centenary Exhibition");
    expect(cleanCandidate("Hong Kong Opens New Airport Terminal")).toBe("Hong Kong Opens New Airport Terminal");
    expect(cleanCandidate("The Louvre Abu Dhabi Annex opens to the public")).toBe("Louvre Abu Dhabi Annex");
  });
  it("maps a candidate to a wikipedia row (popularity 40, confidence 0.6, classify fallback culture)", () => {
    const ev = candidateToEvent({ date: "2027-12-10", title: "Nobel Prize ceremony in Stockholm" }, 2027, NOW)!;
    expect(ev.source_key).toBe("wikipedia:2027:nobel-prize-ceremony-in-stockholm");
    expect(ev.slug).toBe("nobel-prize-ceremony-in-stockholm-2027-12-10");
    expect(ev.popularity).toBe(40);
    expect(ev.confidence).toBe(0.6);
    expect(ev.category).toBe("culture");
    expect(ev.tags).toContain("wikipedia");
    const sport = candidateToEvent({ date: "2027-02-14", title: "Super Bowl LXI", endDate: "2027-02-15" }, 2027, NOW)!;
    expect(sport.category).toBe("sports");
    expect(sport.end_date).toBe("2027-02-15");
    expect(candidateToEvent({ date: "2026-01-01", title: "Past Event Title" }, 2026, NOW)).toBeNull();
  });
});
