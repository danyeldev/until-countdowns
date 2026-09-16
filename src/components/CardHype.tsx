"use client";

import { useEffect, useState } from "react";
import { fetchHype } from "@/lib/hype-client";
import { formatHypePoints, hypeEventKey } from "@/lib/hype";
import type { CountdownEvent } from "@/lib/types";
import { Icon } from "./Icon";

export function CardHype({
  event,
  points,
}: {
  event: Pick<CountdownEvent, "id" | "slug" | "source">;
  points?: number;
}) {
  const key = hypeEventKey(event);
  const [value, setValue] = useState<number | null>(
    typeof points === "number" && Number.isFinite(points) ? Math.max(0, Math.trunc(points)) : null,
  );

  useEffect(() => {
    if (value != null || !key) return;
    let active = true;
    void fetchHype(key).then((total) => {
      if (active) setValue(total);
    });
    return () => {
      active = false;
    };
  }, [key, value]);

  if (value == null) return null;
  return (
    <span className="hype-card-badge">
      <Icon name="bolt" size={12} />
      <span className="tabular-nums">{formatHypePoints(value)}</span>
      hype
    </span>
  );
}
