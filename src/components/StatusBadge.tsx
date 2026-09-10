import { i18n } from "@/lib/i18n/server";
import type { EventStatus } from "@/lib/types";

const BADGES: Partial<Record<EventStatus, string>> = {
  tentative: "border-amber/50 text-amber",
  postponed: "border-ember/60 text-ember",
  cancelled: "border-ember/60 text-ember line-through decoration-ember/60",
  done: "border-line text-muted",
};

/** Small pill for non-default event statuses; renders nothing for `scheduled` / unknown. */
export async function StatusBadge({ status, className = "" }: { status?: EventStatus | null; className?: string }) {
  const style = status ? BADGES[status] : undefined;
  if (!status || !style) return null;
  const L = await i18n();
  // `done` is the one word the badge does not take from the status names: the pill says the date
  // has been and gone, not that the row is filed as done.
  const label = status === "done" ? L.m.event.statusHappened : L.m.common.status[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${style} ${className}`}
    >
      {label}
    </span>
  );
}
