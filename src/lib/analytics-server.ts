import "server-only";
import { PostHog } from "posthog-node";

function token(): string | undefined {
  return process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
}

export async function captureServer(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const key = token();
  if (!key || !distinctId) return;
  const client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  try {
    client.capture({ distinctId, event, properties });
    await client.shutdown();
  } catch {
    // Analytics must never break sign-up or search.
  }
}
