import { describe, expect, it } from "vitest";
import { collectionErrorMessage, eventFromSnapshot, snapshotFromEvent } from "@/lib/collection";
import {
  assertUserEvent,
  decodeSharePayload,
  encodeSharePayload,
  isPersonalDate,
  personalEventFromRecord,
  userEventFromDraft,
} from "@/lib/user-events";
import type { CountdownEvent } from "@/lib/types";

const draft = { title: "My next trip", date: "2027-06-14", description: "A week away." };
const catalogEvent: CountdownEvent = {
  ...userEventFromDraft(draft), id: "88d1128f-ab94-4a9f-b237-2f012dab7334", slug: "summer-festival-2027",
  source: "musicbrainz", title: "Summer festival", category: "festivals", summary: "An attributed external summary.",
};

function rawPayload(value: unknown): string { return Buffer.from(JSON.stringify(value), "utf8").toString("base64url"); }

describe("personal countdowns and share links", () => {
  it("round trips international text and emoji without changing the content", () => {
    const event = userEventFromDraft({ title: "京都へ旅行 🌸", date: "2027-04-02", description: "Café, música y días felices 🎉", category: "culture" });
    expect(decodeSharePayload(encodeSharePayload(event))).toEqual(event);
    expect(userEventFromDraft({ ...draft, title: "京都" }).slug).not.toBe(userEventFromDraft({ ...draft, title: "東京" }).slug);
  });

  it("validates actual calendar days, field shapes and bounded payloads", () => {
    expect(isPersonalDate("2028-02-29")).toBe(true);
    for (const date of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-06-14T12:00:00Z", "0000-01-01"]) expect(isPersonalDate(date)).toBe(false);
    for (const value of [null, [], { t: 1, d: draft.date }, { t: " ", d: draft.date }, { t: draft.title, d: "2026-02-30" }, { t: draft.title, d: draft.date, b: [] }, { t: "x".repeat(121), d: draft.date }, { t: draft.title, d: draft.date, c: "not-a-category" }]) expect(decodeSharePayload(rawPayload(value))).toBeNull();
    expect(decodeSharePayload("a".repeat(2001))).toBeNull();
    expect(decodeSharePayload("%%%invalid")).toBeNull();
    expect(decodeSharePayload("_w")).toBeNull(); // Invalid UTF-8, not a replacement character.
    expect(encodeSharePayload(userEventFromDraft({ ...draft, title: "" }))).toBe("");
    expect(encodeSharePayload(userEventFromDraft({ ...draft, title: "旅".repeat(120), description: "旅".repeat(500) }))).toBe("");
  });

  it("keeps old personal slugs when a stored record is mapped back", () => {
    const event = { ...userEventFromDraft({ ...draft, title: "京都" }), id: "mine-event-2027-06-14", slug: "mine-event-2027-06-14" };
    expect(personalEventFromRecord(event).slug).toBe(event.slug);
    expect(() => assertUserEvent(userEventFromDraft({ ...draft, date: "2026-02-30" }))).toThrow("valid date");
  });
});

describe("saved catalog snapshots", () => {
  it("keeps compatible saved IDs and browsable snapshots, then refreshes source corrections", () => {
    const snapshot = eventFromSnapshot(snapshotFromEvent(catalogEvent), catalogEvent.id);
    expect(snapshot).toMatchObject({ id: catalogEvent.id, title: catalogEvent.title, date: catalogEvent.date });
    expect(snapshot).not.toHaveProperty("summary");
    expect(eventFromSnapshot({ ...snapshotFromEvent(catalogEvent), date: "2027-07-14", status: "postponed" })?.status).toBe("postponed");
    expect(eventFromSnapshot(null)).toBeNull();
    expect(eventFromSnapshot({ id: "<script>", slug: "x", title: "x", date: catalogEvent.date, category: "festivals" })).toBeNull();
  });

  it("maps collection limit errors to a useful message", () => {
    expect(collectionErrorMessage({ code: "P0001", message: "collection_limit" })).toMatch(/200 items/);
    expect(collectionErrorMessage({ code: "42501", message: "permission denied" })).toMatch(/Sign in/);
  });
});
