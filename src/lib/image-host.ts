/**
 * Public media host. Client-safe: only the CDN origin, no credentials.
 *
 * New objects live on Cloudflare R2 at `NEXT_PUBLIC_R2_PUBLIC_URL`. Rows stored
 * before the move still have Supabase public-object URLs; `hostedMediaUrl`
 * rewrites those onto the R2 host so one env flip serves both.
 */
export function r2PublicBase(): string | null {
  const raw = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function r2ObjectUrl(path: string): string | null {
  const base = r2PublicBase();
  const key = path.replace(/^\/+/, "");
  if (!base || !key) return null;
  return `${base}/${key}`;
}

const SUPABASE_PUBLIC_OBJECT = /\/storage\/v1\/object\/public\/(?:event-images|collection-images)\/(.+)$/;

/** Map a stored Supabase public URL onto the R2 host, or return the original. */
export function hostedMediaUrl(url: string): string {
  const base = r2PublicBase();
  if (!base || !url) return url;
  try {
    const path = new URL(url).pathname;
    const match = path.match(SUPABASE_PUBLIC_OBJECT);
    if (match) return `${base}/${match[1]}`;
  } catch {
    /* leave as-is */
  }
  return url;
}
