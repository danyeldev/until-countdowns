import type { EventStatus } from "@/lib/types";

const BADGES: Partial<
  Record<EventStatus, { label: string; className: string }>
> = {
  tentative: {
    label: "Tentative",
    className: "border-amber/35 bg-amber/10 text-amber",
  },
  postponed: {
    label: "Postponed",
    className: "border-ember/40 bg-ember/10 text-ember",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-ember/40 bg-ember/10 text-ember",
  },
  done: { label: "Happened", className: "border-line bg-ink text-paper-dim" },
  retired: {
    label: "Archived",
    className: "border-line bg-ink text-paper-dim",
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
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs leading-none font-medium ${badge.className} ${className}`}
    >
      {badge.label}
    </span>
  );
}
