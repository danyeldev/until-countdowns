/** Default per-request timeout for Supabase calls (ms). */
export const SUPABASE_TIMEOUT_MS = 10_000;

/**
 * `fetch` with a hard deadline, so a stalled connection during `next build`
 * (generateStaticParams, prerenders) or an ISR regeneration rejects with an
 * AbortError — which `safe()` turns into the empty fallback — instead of hanging.
 * A caller-provided signal (supabase-js `abortSignal()`) is honoured alongside the timeout.
 */
export function boundedFetch(timeoutMs = SUPABASE_TIMEOUT_MS): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal =
      init?.signal && typeof AbortSignal.any === "function" ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetch(input, { ...init, signal });
  };
}
