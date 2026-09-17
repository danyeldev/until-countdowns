import type { EventStatus } from "@/lib/types";

const BADGES: Partial<
  Record<EventStatus, { label: string; className: string }>
> = {
  tentative: {
    label: "Tentative",
    className: "bg-amber/15 text-amber",
  },
  postponed: {
    label: "Postponed",
    className: "bg-ember/15 text-ember",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-ember/15 text-ember",
  },
  done: { label: "Happened", className: "bg-surface text-paper-dim" },
  retired: {
    label: "Archived",
    className: "bg-surface text-paper-dim",
  },
};

/** Small pill for non-default event statuses; renders nothing for `scheduled` / unknown. */
export function StatusBadge({
  status,
  className = "",
}: {
  status?: EventStatus | null;
  className?: string;
}) {
  const badge = status ? BADGES[status] : undefined;
  if (!badge) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] leading-none font-medium ${badge.className} ${className}`}
    >
      {badge.label}
    </span>
  );
}
