/**
 * One-off copy of catalog derivatives from Supabase Storage to the until-images R2 bucket.
 * Uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY and the R2 S3 credentials.
 */
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

const variants = [
  { file: "hero.webp", type: "image/webp", cache: "31536000" },
  { file: "card.webp", type: "image/webp", cache: "31536000" },
  { file: "og.jpg", type: "image/jpeg", cache: "31536000" },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET || "until-images";
if (!url || !key || !accountId || !accessKeyId || !secretAccessKey) {
  throw new Error("Missing Supabase or R2 credentials in the environment");
}

const db = createClient(url, key, { auth: { persistSession: false } });
const aws = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
const origin = `https://${accountId}.r2.cloudflarestorage.com`;

function objectUrl(objectKey) {
  return `${origin}/${bucket}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
}

function sibling(publicUrl, file) {
  const cut = publicUrl.lastIndexOf("/");
  return cut < 0 ? publicUrl : `${publicUrl.slice(0, cut + 1)}${file}`;
}

async function listAll() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("images").select("sha256, public_url").range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

async function copyOne(src, objectKey, type, cache) {
  const res = await fetch(src);
  if (res.status === 404 || res.status === 400) return "missing";
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const body = new Uint8Array(await res.arrayBuffer());
  const put = await aws.fetch(objectUrl(objectKey), {
    method: "PUT",
    body,
    headers: { "Content-Type": type, "Cache-Control": `public, max-age=${cache}` },
  });
  if (!put.ok) throw new Error(`put HTTP ${put.status}`);
  return "copied";
}

const rows = await listAll();
const stats = { copied: 0, skip: 0, missing: 0, errors: 0 };
const queue = [];
for (const row of rows) {
  for (const variant of variants) {
    queue.push({ src: sibling(row.public_url, variant.file), key: `${row.sha256}/${variant.file}`, ...variant });
  }
}
console.log("rows", rows.length, "objects", queue.length);

const concurrency = 16;
let i = 0;
async function worker() {
  while (i < queue.length) {
    const item = queue[i++];
    if (i % 200 === 0) console.log("progress", i, "/", queue.length, stats);
    try {
      stats[await copyOne(item.src, item.key, item.type, item.cache)]++;
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 20) console.log("error", item.key, err instanceof Error ? err.message : err);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));
console.log("done", stats);
