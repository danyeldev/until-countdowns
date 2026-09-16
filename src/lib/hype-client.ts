import { isHypeKind, parseHypeEventKey, parseHypeSnapshot, type HypeKind, type HypeSnapshot } from "./hype";

export async function fetchHype(eventKey: string): Promise<number> {
  const key = parseHypeEventKey(eventKey);
  if (!key) return 0;
  try {
    const response = await fetch(`/api/hype?eventKey=${encodeURIComponent(key)}`, { cache: "no-store" });
    if (!response.ok) return 0;
    const snapshot = parseHypeSnapshot(await response.json());
    return snapshot?.points ?? 0;
  } catch {
    return 0;
  }
}

export async function recordHype(eventKey: string, kind: HypeKind): Promise<HypeSnapshot | null> {
  const key = parseHypeEventKey(eventKey);
  if (!key || !isHypeKind(kind)) return null;
  try {
    const response = await fetch("/api/hype", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventKey: key, kind }),
    });
    if (!response.ok) return null;
    return parseHypeSnapshot(await response.json());
  } catch {
    return null;
  }
}
