import posthog from "posthog-js";

export { ANALYTICS_EVENTS, distinctIdFromCookieHeader } from "./analytics-shared";

function token(): string | undefined {
  return process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
}

function ensureClient(): typeof posthog | null {
  const key = token();
  if (!key || typeof window === "undefined") return null;
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
  (window as Window & { posthog?: typeof posthog }).posthog = posthog;
  return posthog;
}

export function initPosthog(): void {
  ensureClient();
}

export function capture(event: string, properties?: Record<string, unknown>): void {
  ensureClient()?.capture(event, properties);
}

export function captureException(error: unknown, properties?: Record<string, unknown>): void {
  const client = ensureClient();
  if (!client) return;
  const err = error instanceof Error ? error : new Error(String(error));
  client.captureException(err, properties);
}

export function identifyUser(distinctId: string, properties?: Record<string, unknown>): void {
  if (!distinctId) return;
  ensureClient()?.identify(distinctId, properties);
}

export function resetUser(): void {
  ensureClient()?.reset();
}
