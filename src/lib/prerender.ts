/**
 * Avoid a build-time database stampede. Catalog pages use on-demand ISR by default;
 * deployments can opt into warming a bounded number of pages per route family.
 */
export function prerenderLimit(maximum: number): number {
  const raw = process.env.CATALOG_PRERENDER_LIMIT?.trim();
  if (!raw || !/^\d+$/.test(raw)) {
    return process.env.VERCEL_ENV === "production" ? Math.min(maximum, 200) : 0;
  }
  return Math.min(maximum, Math.max(0, Number(raw)));
}
