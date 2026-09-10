import type { EventStatus } from "@/lib/types";

const BADGES: Partial<Record<EventStatus, { label: string; className: string }>> = {
  tentative: { label: "Tentative", className: "border-amber/50 text-amber" },
  postponed: { label: "Postponed", className: "border-ember/60 text-ember" },
  cancelled: { label: "Cancelled", className: "border-ember/60 text-ember line-through decoration-ember/60" },
  done: { label: "Happened", className: "border-line text-muted" },
};

/** Small pill for non-default event statuses; renders nothing for `scheduled` / unknown. */
export function StatusBadge({ status, className = "" }: { status?: EventStatus | null; className?: string }) {
  const badge = status ? BADGES[status] : undefined;
  if (!badge) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${badge.className} ${className}`}
    >
      {badge.label}
    </span>
  );
}
