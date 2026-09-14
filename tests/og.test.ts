import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { CACHE_DATED, daysBetween, OG_MAX_BYTES, parseOgDate, renderOgCard } from "@/lib/og";

describe("social preview correctness", () => {
  it("rejects nonexistent calendar dates and accepts leap days", () => {
    expect(parseOgDate("2026-02-30.png")).toBeNull();
    expect(parseOgDate("2026-13-01")).toBeNull();
    expect(parseOgDate("2028-02-29.png")).toBe("2028-02-29");
  });

  it("counts the local event day and rejects invalid inputs", () => {
    expect(daysBetween("2026-09-14", "2026-09-15T00:00:00Z", false, "America/New_York")).toBe(0);
    expect(daysBetween("2026-09-14", "2026-09-15", true)).toBe(1);
    expect(daysBetween("2026-02-30", "2026-09-15", true)).toBeNull();
    expect(daysBetween("2026-09-14", "not-a-date", true)).toBeNull();
    expect(CACHE_DATED).not.toContain("immutable");
  });

  it("renders a social card within the image dimensions and size budget", async () => {
    const response = await renderOgCard({ eyebrow: "Space", title: "The next total solar eclipse", subtitle: "Monday, 2 August 2027", days: 322, seed: "eclipse" });
    const png = Buffer.from(await response.arrayBuffer());
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(png.byteLength).toBeLessThan(OG_MAX_BYTES);
    expect(await sharp(png).metadata()).toMatchObject({ width: 1200, height: 630, format: "png" });
  });
});
