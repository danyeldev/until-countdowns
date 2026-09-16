"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createAuthBrowserClient } from "@/lib/auth/browser";
import { isAuthConfigured } from "@/lib/auth/env";
import { fetchHype, recordHype } from "@/lib/hype-client";
import {
  formatHypePoints,
  HYPE_KIND_LABEL,
  isHypeKind,
  parseHypeEventKey,
  type HypeKind,
} from "@/lib/hype";
import { Icon } from "./Icon";

type Pop = { id: number; kind: HypeKind; points: number };

export function HypeMeter({ eventKey }: { eventKey: string }) {
  const key = parseHypeEventKey(eventKey);
  const labelId = useId();
  const [points, setPoints] = useState<number | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const seen = useRef(0);
  const nextPop = useRef(1);

  useEffect(() => {
    if (!key || !isAuthConfigured()) return;
    const eventKey = key;
    let active = true;
    const client = createAuthBrowserClient();

    function pushPop(kind: HypeKind, added: number, total: number) {
      if (added <= 0) {
        setPoints(total);
        return;
      }
      const id = nextPop.current;
      nextPop.current += 1;
      setPoints(total);
      setPops((current) => [...current.slice(-2), { id, kind, points: added }]);
      window.setTimeout(() => {
        setPops((current) => current.filter((item) => item.id !== id));
      }, 2200);
    }

    async function load() {
      const total = await fetchHype(eventKey);
      if (!active) return;
      if (total >= seen.current) {
        seen.current = total;
        setPoints(total);
      }
    }

    void load();

    const channel = client
      .channel(`hype:${eventKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_hype", filter: `event_key=eq.${eventKey}` },
        (payload) => {
          const row = payload.new as { points?: unknown; last_kind?: unknown; last_points?: unknown };
          const total = typeof row.points === "number" ? row.points : null;
          if (total == null || total <= seen.current) {
            if (total != null) setPoints(total);
            return;
          }
          const added = typeof row.last_points === "number" ? row.last_points : total - seen.current;
          seen.current = total;
          pushPop(isHypeKind(row.last_kind) ? row.last_kind : "visit", added, total);
        },
      )
      .subscribe();

    const visitTimer = window.setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      void recordHype(eventKey, "visit").then((snapshot) => {
        if (!active || !snapshot) return;
        if (snapshot.points > seen.current) {
          seen.current = snapshot.points;
          pushPop(snapshot.kind ?? "visit", snapshot.added, snapshot.points);
        } else {
          setPoints(snapshot.points);
        }
      });
    }, 2500);

    return () => {
      active = false;
      window.clearTimeout(visitTimer);
      void client.removeChannel(channel);
    };
  }, [key]);

  if (!key || !isAuthConfigured()) return null;

  return (
    <div className="hype-meter relative mt-6 inline-flex min-h-11 items-center gap-3">
      <p id={labelId} className="flex items-center gap-2 text-sm font-medium text-amber">
        <Icon name="spark" size={16} />
        <span className={`tabular-nums text-lg tracking-tight text-paper sm:text-xl ${pops.length ? "hype-tick" : ""}`}>
          {points == null ? "—" : formatHypePoints(points)}
        </span>
        <span className="text-paper-dim">hype</span>
      </p>
      <span className="sr-only">Live score from visits, saves, calendar adds, shares, and comments.</span>
      <ul aria-live="polite" aria-atomic="false" className="pointer-events-none flex flex-col justify-center gap-1">
        {pops.map((pop) => (
          <li key={pop.id} className="hype-pop text-xs font-medium text-moss">
            +{pop.points} {HYPE_KIND_LABEL[pop.kind]}
          </li>
        ))}
      </ul>
    </div>
  );
}
