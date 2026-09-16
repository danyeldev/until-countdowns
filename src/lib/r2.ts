import "server-only";
import { AwsClient } from "aws4fetch";
import { r2ObjectUrl } from "@/lib/image-host";
import type { StorageLike } from "@/lib/enrich/images/process";

export const DEFAULT_R2_BUCKET = "until-images";

export function r2Bucket(): string {
  return process.env.R2_BUCKET?.trim() || DEFAULT_R2_BUCKET;
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      r2ObjectUrl("ok"),
  );
}

function r2Client(): { aws: AwsClient; origin: string; bucket: string } {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 is not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY");
  }
  return {
    aws: new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: "s3",
      region: "auto",
    }),
    origin: `https://${accountId}.r2.cloudflarestorage.com`,
    bucket: r2Bucket(),
  };
}

function objectUrl(origin: string, bucket: string, key: string): string {
  const encoded = key
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${origin}/${bucket}/${encoded}`;
}

export async function putR2Object(
  key: string,
  body: Buffer | Uint8Array,
  options: { contentType: string; cacheControl: string },
): Promise<void> {
  const { aws, origin, bucket } = r2Client();
  const res = await aws.fetch(objectUrl(origin, bucket, key), {
    method: "PUT",
    body: Uint8Array.from(body),
    headers: {
      "Content-Type": options.contentType,
      "Cache-Control": `public, max-age=${options.cacheControl}`,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`R2 put ${key} failed: HTTP ${res.status}${detail ? ` ${detail.slice(0, 180)}` : ""}`);
  }
}

export async function deleteR2Objects(keys: string[]): Promise<void> {
  const unique = [...new Set(keys.map((key) => key.replace(/^\/+/, "")).filter(Boolean))];
  if (!unique.length) return;
  const { aws, origin, bucket } = r2Client();
  const errors: string[] = [];
  for (const key of unique) {
    const res = await aws.fetch(objectUrl(origin, bucket, key), { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      errors.push(`${key}: HTTP ${res.status}`);
    }
  }
  if (errors.length) throw new Error(`R2 delete failed: ${errors.join("; ")}`);
}

export function r2StorageLike(): StorageLike {
  return {
    from: () => ({
      async upload(path, body, options) {
        try {
          await putR2Object(path, body, {
            contentType: options.contentType,
            cacheControl: options.cacheControl,
          });
          return { error: null };
        } catch (err) {
          return { error: { message: err instanceof Error ? err.message : String(err) } };
        }
      },
      getPublicUrl: (path) => ({ data: { publicUrl: r2ObjectUrl(path) ?? "" } }),
      async remove(paths) {
        try {
          await deleteR2Objects(paths);
          return { error: null };
        } catch (err) {
          return { error: { message: err instanceof Error ? err.message : String(err) } };
        }
      },
    }),
  };
}
