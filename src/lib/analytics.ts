type Posthog = typeof import("posthog-js").default;

function token(): string | undefined {
  return process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
}

let client: Posthog | null = null;
let loading: Promise<Posthog | null> | null = null;

function load(): Promise<Posthog | null> {
  const key = token();
  if (!key || typeof window === "undefined") return Promise.resolve(null);
  if (client) return Promise.resolve(client);
  if (loading) return loading;
  loading = import("posthog-js").then((mod) => {
    const posthog = mod.default;
    if (!posthog.__loaded) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        defaults: "2026-05-30",
        autocapture: false,
        capture_pageview: true,
        capture_pageleave: true,
        capture_performance: { web_vitals: true },
      });
    }
    client = posthog;
    (window as Window & { posthog?: Posthog }).posthog = posthog;
    return posthog;
  });
  return loading;
}

export function initPosthog(): void {
  if (typeof window === "undefined" || !token()) return;
  const idle =
    window.requestIdleCallback ??
    ((cb: IdleRequestCallback) => window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 1));
  idle(() => {
    void load();
  });
}

export function capture(event: string, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !token()) return;
  void load().then((posthog) => posthog?.capture(event, properties));
}

export function identifyUser(distinctId: string, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !token() || !distinctId) return;
  void load().then((posthog) => posthog?.identify(distinctId, properties));
}

export function resetUser(): void {
  if (typeof window === "undefined" || !token()) return;
  void load().then((posthog) => posthog?.reset());
}
