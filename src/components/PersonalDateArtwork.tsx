import { isPersonalDate } from "@/lib/user-events";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A personal date becomes its own cover; no invented photos or remote assets. */
export function PersonalDateArtwork({ date, compact = false }: { date: string; compact?: boolean }) {
  const valid = isPersonalDate(date);
  const [year, month, day] = date.split("-");
  return (
    <div aria-hidden="true" className={`relative isolate overflow-hidden rounded-2xl bg-ink text-amber ${compact ? "h-32" : "h-48 sm:h-56"}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-amber/25 via-amber/5 to-ink" />
      <div className="absolute -right-12 top-4 h-64 w-44 rotate-[24deg] rounded-[2rem] bg-amber/10" />
      <div className="absolute -right-3 top-7 h-64 w-32 rotate-[24deg] rounded-[2rem] bg-ink-2/70" />
      <div className={`relative flex h-full items-end justify-between gap-4 ${compact ? "px-5 py-3" : "px-7 py-5 sm:px-8"}`}>
        <div><p className="text-sm font-medium text-paper-dim">{valid ? MONTHS[Number(month) - 1] : "Your date"}</p><p className={`font-semibold leading-[.9] tracking-[-.08em] tabular-nums ${compact ? "mt-1 text-7xl" : "mt-2 text-[7rem] sm:text-[8rem]"}`}>{valid ? day : "—"}</p></div>
        <span className="relative mb-1 rounded-full bg-ink/70 px-3 py-1.5 text-sm font-medium tabular-nums text-paper-dim">{valid ? year : "Until"}</span>
      </div>
    </div>
  );
}
