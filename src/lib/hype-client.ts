import { isHypeKind, parseHypeEventKey, parseHypeSnapshot, type HypeKind, type HypeSnapshot } from "./hype";

const READ_TTL_MS = 60_000;
const MAX_CACHED_EVENTS = 256;
type CachedHype = { points: number; expiresAt: number; pending?: Promise<number> };
const reads = new Map<string, CachedHype>();

function cachedHype(key: string): CachedHype {
  const existing = reads.get(key);
  if (existing) return existing;
  const entry = { points: 0, expiresAt: 0 };
  reads.set(key, entry);
  if (reads.size > MAX_CACHED_EVENTS) reads.delete(reads.keys().next().value!);
  return entry;
}

export async function fetchHype(eventKey: string): Promise<number> {
  const key = parseHypeEventKey(eventKey);
  if (!key) return 0;
  const entry = cachedHype(key);
  if (entry.expiresAt > Date.now()) return entry.points;
  if (entry.pending) return entry.pending;
  entry.pending = (async () => {
    try {
      const response = await fetch(`/api/hype?eventKey=${encodeURIComponent(key)}`, { credentials: "omit" });
      if (!response.ok) return entry.points;
      const snapshot = parseHypeSnapshot(await response.json());
      if (snapshot) {
        // Scores are cumulative. A CDN response (including an in-flight read) must
        // never undo the authoritative total received from this visitor's write.
        entry.points = Math.max(entry.points, snapshot.points);
        entry.expiresAt = Date.now() + READ_TTL_MS;
      }
      return entry.points;
    } catch {
      return entry.points;
    } finally {
      entry.pending = undefined;
    }
  })();
  return entry.pending;
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
    const snapshot = parseHypeSnapshot(await response.json());
    if (snapshot) {
      const entry = cachedHype(key);
      entry.points = Math.max(entry.points, snapshot.points);
      entry.expiresAt = Date.now() + READ_TTL_MS;
    }
    return snapshot;
  } catch {
    return null;
  }
}
