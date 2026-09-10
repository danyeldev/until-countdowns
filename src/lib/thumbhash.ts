/**
 * ThumbHash → `data:` URL, for `next/image`'s blur placeholder.
 *
 * `images.thumbhash` holds the base64 of a ~25-byte hash produced by the enrichment pipeline;
 * decoding it yields a tiny PNG that stands in for the photo until it loads. The decode is cheap
 * and deterministic, so it happens on the server and no thumbhash code reaches the browser —
 * but the module only uses `atob`/`btoa` and works in either place.
 *
 * Every failure path returns `undefined`: a missing placeholder is a cosmetic loss, never a
 * render error.
 */
import { thumbHashToDataURL } from "thumbhash";

/** Guard rails around a value that comes from the database. */
const MIN_HASH_BYTES = 5;
const MAX_HASH_BYTES = 64;

function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export function thumbhashToDataUrl(hash: string | null | undefined): string | undefined {
  if (!hash) return undefined;
  const bytes = decodeBase64(hash.trim());
  if (!bytes || bytes.length < MIN_HASH_BYTES || bytes.length > MAX_HASH_BYTES) return undefined;
  try {
    return thumbHashToDataURL(bytes);
  } catch {
    return undefined;
  }
}
