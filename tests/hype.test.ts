import { describe, expect, it } from "vitest";
import {
  formatHypePoints,
  HYPE_KIND_LABEL,
  HYPE_POINTS,
  hypeEventKey,
  isHypeKind,
  parseHypeEventKey,
  parseHypeSnapshot,
  parseHypeVisitorId,
} from "@/lib/hype";

describe("hype scale", () => {
  it("weights attention below commitment", () => {
    expect(HYPE_POINTS.visit).toBe(1);
    expect(HYPE_POINTS.save).toBe(5);
    expect(HYPE_POINTS.calendar).toBe(10);
    expect(HYPE_POINTS.share).toBe(15);
    expect(HYPE_POINTS.comment).toBe(20);
    expect(HYPE_POINTS.visit).toBeLessThan(HYPE_POINTS.save);
    expect(HYPE_POINTS.save).toBeLessThan(HYPE_POINTS.calendar);
    expect(HYPE_POINTS.calendar).toBeLessThan(HYPE_POINTS.share);
    expect(HYPE_POINTS.share).toBeLessThan(HYPE_POINTS.comment);
  });

  it("labels the live increment", () => {
    expect(HYPE_KIND_LABEL.share).toBe("shared");
    expect(isHypeKind("share")).toBe(true);
    expect(isHypeKind("like")).toBe(false);
  });
});

describe("hype keys", () => {
  it("accepts catalog slugs and personal countdowns, not share payloads", () => {
    expect(parseHypeEventKey("halloween-2026-10-31")).toBe("halloween-2026-10-31");
    expect(parseHypeEventKey("mine-trip-2026-10-31")).toBe("mine-trip-2026-10-31");
    expect(parseHypeEventKey("share-abc")).toBeNull();
    expect(hypeEventKey({ id: "halloween-2026-10-31", slug: "halloween-2026", source: "curated" })).toBe(
      "halloween-2026-10-31",
    );
    expect(hypeEventKey({ id: "mine-trip-2026-10-31", slug: "mine-trip-2026-10-31", source: "user" })).toBe(
      "mine-trip-2026-10-31",
    );
  });

  it("accepts minted visitor ids only", () => {
    expect(parseHypeVisitorId("v:11111111-1111-1111-1111-111111111111")).toMatch(/^v:/);
    expect(parseHypeVisitorId("u:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toMatch(/^u:/);
    expect(parseHypeVisitorId("11111111-1111-1111-1111-111111111111")).toBeNull();
    expect(parseHypeVisitorId("v:nope")).toBeNull();
  });

  it("reads rpc snapshots and formats the score", () => {
    expect(parseHypeSnapshot({ points: 36, added: 15, kind: "share" })).toEqual({
      points: 36,
      added: 15,
      kind: "share",
    });
    expect(parseHypeSnapshot({ points: 0 })).toEqual({ points: 0, added: 0, kind: null });
    expect(parseHypeSnapshot(null)).toBeNull();
    expect(formatHypePoints(1240)).toBe("1,240");
  });
});
