import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheSavedEvents, decodeSharePayload, encodeSharePayload, getMineSnapshot, getSavedEventsSnapshot,
  getSavedSnapshot, isPersonalDate, loadMine, loadSaved, parseMine, parseSavedEvents, parseSavedIds,
  removeMine, toggleSaved, upsertMine, userEventFromDraft,
} from "@/lib/user-events";
import type { CountdownEvent } from "@/lib/types";

const values = new Map<string, string>();
let writesBlocked = false;
const localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { if (writesBlocked) throw new Error("QuotaExceededError"); values.set(key, value); },
};
const draft = { title: "My next trip", date: "2027-06-14", description: "A week away." };
const catalogEvent: CountdownEvent = {
  ...userEventFromDraft(draft), id: "88d1128f-ab94-4a9f-b237-2f012dab7334", slug: "summer-festival-2027",
  source: "musicbrainz", title: "Summer festival", category: "festivals", summary: "An attributed external summary.",
};

beforeEach(() => {
  values.clear();
  writesBlocked = false;
  const target = new EventTarget();
  vi.stubGlobal("window", { localStorage, addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target), dispatchEvent: target.dispatchEvent.bind(target) });
});
afterEach(() => vi.unstubAllGlobals());

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

  it("upserts and removes a personal countdown without duplicating its stable link", () => {
    const event = userEventFromDraft(draft);
    upsertMine(event);
    upsertMine({ ...event, description: "Updated note" });
    expect(loadMine()).toHaveLength(1);
    expect(loadMine()[0].description).toBe("Updated note");
    expect(removeMine(event.id)).toEqual([]);
    expect(loadMine()).toEqual([]);
    expect(() => upsertMine(userEventFromDraft({ ...draft, date: "2026-02-30" }))).toThrow("valid date");
  });
});

describe("defensive local storage", () => {
  it("ignores malformed JSON, wrong container types and corrupted records", () => {
    for (const raw of ["undefined", "null", "{}", '"text"', "[null,2,{},[]]"]) {
      expect(parseMine(raw)).toEqual([]);
      expect(parseSavedEvents(raw)).toEqual([]);
      expect(parseSavedIds(raw)).toEqual([]);
    }
    values.set("until:mine", JSON.stringify([null, userEventFromDraft(draft)]));
    values.set("until:saved", JSON.stringify([null, {}, "valid-id", "valid-id", "<script>"]));
    expect(loadMine()).toHaveLength(1);
    expect(loadSaved()).toEqual(["valid-id"]);
  });

  it("does not crash snapshots or readers when storage access itself is blocked", () => {
    vi.stubGlobal("window", { get localStorage() { throw new Error("SecurityError"); } });
    expect(getMineSnapshot()).toBe("[]");
    expect(getSavedSnapshot()).toBe("[]");
    expect(loadMine()).toEqual([]);
    expect(loadSaved()).toEqual([]);
    expect(() => upsertMine(userEventFromDraft(draft))).toThrow("Could not save on this device");
  });

  it("reports failed writes and leaves the saved state unchanged", () => {
    writesBlocked = true;
    expect(() => toggleSaved(catalogEvent.id, catalogEvent)).toThrow("Could not save on this device");
    expect(loadSaved()).toEqual([]);
    expect(() => upsertMine(userEventFromDraft(draft))).toThrow("Could not save on this device");
    expect(loadMine()).toEqual([]);
  });

  it("keeps compatible saved IDs and browsable snapshots, then refreshes source corrections", () => {
    toggleSaved(catalogEvent.id, catalogEvent);
    expect(loadSaved()).toEqual([catalogEvent.id]);
    const snapshot = parseSavedEvents(getSavedEventsSnapshot())[0];
    expect(snapshot).toMatchObject({ id: catalogEvent.id, title: catalogEvent.title, date: catalogEvent.date });
    expect(snapshot).not.toHaveProperty("summary");
    cacheSavedEvents([{ ...catalogEvent, date: "2027-07-14", status: "postponed" }]);
    expect(parseSavedEvents(getSavedEventsSnapshot())[0]).toMatchObject({ date: "2027-07-14", status: "postponed" });
    toggleSaved(catalogEvent.id);
    expect(loadSaved()).toEqual([]);
    expect(parseSavedEvents(getSavedEventsSnapshot())).toEqual([]);
  });

  it("keeps old personal slugs valid and caps corrupted oversized saved arrays", () => {
    const event = { ...userEventFromDraft({ ...draft, title: "京都" }), id: "mine-event-2027-06-14", slug: "mine-event-2027-06-14" };
    expect(parseMine(JSON.stringify([event]))[0].slug).toBe(event.slug);
    const legacy = { ...event, description: "A long existing note. ".repeat(100) };
    expect(parseMine(JSON.stringify([legacy]))[0].description).toBe(legacy.description.trim());
    expect(parseSavedIds(JSON.stringify(Array.from({ length: 1000 }, (_, index) => `id-${index}`)))).toHaveLength(200);
  });

  it("removes a personal countdown from both collections without leaving a hidden snapshot", () => {
    const event = userEventFromDraft(draft);
    upsertMine(event);
    toggleSaved(event.id, event);
    removeMine(event.id);
    expect(loadMine()).toEqual([]);
    expect(loadSaved()).toEqual([]);
    expect(parseSavedEvents(getSavedEventsSnapshot())).toEqual([]);
  });
});
