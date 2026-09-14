import { eventInstant, isCoarsePrecision, localDateString } from "./time";
import type { CountdownEvent } from "./types";
import { encodeSharePayload } from "./user-events";

export type CollectionPhase = "upcoming" | "changed" | "past" | "unavailable";

/** Group around the actual date/state, keeping estimates and today's all-day dates active. */
export function collectionPhase(event: CountdownEvent | undefined, now: number): CollectionPhase {
  if (!event) return "unavailable";
  if (["cancelled", "postponed", "retired"].includes(event.status ?? "")) return "changed";
  if (event.status === "done") return "past";
  const today = localDateString(now);
  if (isCoarsePrecision(event.datePrecision)) return event.periodEnd && event.periodEnd < today ? "past" : "upcoming";
  if (event.allDay && !event.date.includes("T")) return (event.endDate ?? event.date).slice(0, 10) < today ? "past" : "upcoming";
  return eventInstant(event.endDate ?? event.date, event.allDay).getTime() < now ? "past" : "upcoming";
}

/** A saved shared countdown must carry its content across browsers, unlike an owned local date. */
export function collectionEventPath(event: CountdownEvent, personal: boolean): string {
  if (event.source === "user" && !personal) {
    const payload = encodeSharePayload(event);
    if (payload) return `/event/share-${payload}`;
  }
  return `/event/${event.slug}`;
}
