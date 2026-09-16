import { parseCommentEventKey } from "./comments";
import type { CountdownEvent } from "./types";

export const HYPE_KINDS = ["visit", "save", "calendar", "share", "comment"] as const;
export type HypeKind = (typeof HYPE_KINDS)[number];

/** Intent-weighted scale. Visits are cheap and daily; comments take the most work. */
export const HYPE_POINTS: Record<HypeKind, number> = {
  visit: 1,
  save: 5,
  calendar: 10,
  share: 15,
  comment: 20,
};

export const HYPE_KIND_LABEL: Record<HypeKind, string> = {
  visit: "visit",
  save: "saved",
  calendar: "calendar",
  share: "shared",
  comment: "comment",
};

export const HYPE_VISITOR_COOKIE = "until_hype";
export const HYPE_HOUR_LIMIT = 40;

export type HypeSnapshot = {
  points: number;
  added: number;
  kind: HypeKind | null;
};

export function isHypeKind(value: unknown): value is HypeKind {
  return typeof value === "string" && (HYPE_KINDS as readonly string[]).includes(value);
}

export function parseHypeEventKey(value: unknown): string | null {
  return parseCommentEventKey(value);
}

export function hypeEventKey(event: Pick<CountdownEvent, "id" | "slug" | "source">): string | null {
  if (event.source === "user") return parseHypeEventKey(event.slug);
  return parseHypeEventKey(event.id) ?? parseHypeEventKey(event.slug);
}

export function parseHypeVisitorId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^(u|v):[a-z0-9-]{8,80}$/.test(value) ? value : null;
}

export function formatHypePoints(points: number): string {
  return Math.max(0, Math.trunc(points)).toLocaleString("en-US");
}

export function parseHypeSnapshot(value: unknown): HypeSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const points = typeof record.points === "number" && Number.isFinite(record.points) ? Math.max(0, Math.trunc(record.points)) : null;
  if (points == null) return null;
  const added = typeof record.added === "number" && Number.isFinite(record.added) ? Math.max(0, Math.trunc(record.added)) : 0;
  return { points, added, kind: isHypeKind(record.kind) ? record.kind : null };
}
