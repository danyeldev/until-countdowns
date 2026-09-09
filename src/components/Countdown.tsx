"use client";

import { useEffect, useState } from "react";
import { remainingUntil, type Remaining } from "@/lib/time";

function Unit({ value, label, huge }: { value: number; label: string; huge?: boolean }) {
  return (
    <div className="flex flex-col items-center min-w-0">
      <span
        className={`tabular font-mono tracking-tight text-amber amber-glow ${
          huge ? "text-5xl sm:text-7xl md:text-8xl" : "text-2xl sm:text-3xl"
        }`}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted">{label}</span>
    </div>
  );
}

export function Countdown({
  date,
  allDay = true,
  size = "card",
}: {
  date: string;
  allDay?: boolean;
  size?: "card" | "hero";
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const r: Remaining = remainingUntil(date, allDay, now);
  const huge = size === "hero";

  if (r.past) {
    return (
      <p className={`font-serif italic text-muted ${huge ? "text-2xl" : "text-sm"}`}>
        This one already happened.
      </p>
    );
  }

  return (
    <div className={`flex items-end justify-between gap-3 ${huge ? "max-w-3xl" : ""}`}>
      <Unit value={r.days} label={r.days === 1 ? "day" : "days"} huge={huge} />
      <span className={`text-muted pb-4 ${huge ? "text-4xl" : "text-lg"}`}>:</span>
      <Unit value={r.hours} label="hrs" huge={huge} />
      <span className={`text-muted pb-4 ${huge ? "text-4xl" : "text-lg"}`}>:</span>
      <Unit value={r.minutes} label="min" huge={huge} />
      <span className={`text-muted pb-4 ${huge ? "text-4xl" : "text-lg"}`}>:</span>
      <Unit value={r.seconds} label="sec" huge={huge} />
    </div>
  );
}
