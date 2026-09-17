import posthog from "posthog-js";

function token(): string | undefined {
  return process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
}

export function initPosthog(): void {
  const key = token();
  if (!key || typeof window === "undefined" || posthog.__loaded) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    defaults: "2026-05-30",
  });
  (window as Window & { posthog?: typeof posthog }).posthog = posthog;
}

export function capture(event: string, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !token()) return;
  initPosthog();
  posthog.capture(event, properties);
}

export function identifyUser(distinctId: string, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !token() || !distinctId) return;
  initPosthog();
  posthog.identify(distinctId, properties);
}

export function resetUser(): void {
  if (typeof window === "undefined" || !token()) return;
  initPosthog();
  posthog.reset();
}
