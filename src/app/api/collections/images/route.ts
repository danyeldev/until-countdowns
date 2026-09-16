import { NextResponse } from "next/server";
import { createAuthServerClient, getAuthClaims } from "@/lib/auth/server";
import { isAuthConfigured } from "@/lib/auth/env";
import {
  COLLECTION_IMAGE_BYTES_MAX,
  COLLECTION_IMAGE_TYPES,
  COLLECTION_IMAGES_MAX,
  collectionErrorMessage,
} from "@/lib/collections";
import { deleteR2Objects, isR2Configured, putR2Object } from "@/lib/r2";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers });
}

function imageExtension(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

async function requireOwner(collectionId: string, userId: string) {
  const supabase = await createAuthServerClient();
  const { data, error } = await supabase
    .from("event_collections")
    .select("id, owner_id")
    .eq("id", collectionId)
    .maybeSingle();
  if (error || !data || data.owner_id !== userId) return null;
  return supabase;
}

export async function POST(request: Request) {
  if (!isAuthConfigured()) return json({ error: "Sign in to add photos." }, 401);
  if (!isR2Configured()) return json({ error: "Image storage is not configured." }, 503);
  const claims = await getAuthClaims();
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (!userId) return json({ error: "Sign in to add photos." }, 401);

  const form = await request.formData();
  const collectionId = String(form.get("collectionId") ?? "");
  const position = Number(form.get("position"));
  const file = form.get("file");
  if (!collectionId || !Number.isInteger(position) || position < 0 || !(file instanceof File)) {
    return json({ error: "Choose a photo to add." }, 400);
  }
  if (!COLLECTION_IMAGE_TYPES.includes(file.type as (typeof COLLECTION_IMAGE_TYPES)[number])) {
    return json({ error: "Use a JPEG, PNG, or WebP image." }, 400);
  }
  if (file.size > COLLECTION_IMAGE_BYTES_MAX) return json({ error: "Keep each image under 5 MB." }, 400);

  const supabase = await requireOwner(collectionId, userId);
  if (!supabase) return json({ error: "Could not update that collection. Try again." }, 403);

  const { count, error: countError } = await supabase
    .from("event_collection_images")
    .select("id", { count: "exact", head: true })
    .eq("collection_id", collectionId);
  if (countError) return json({ error: collectionErrorMessage(countError) }, 400);
  if ((count ?? 0) >= COLLECTION_IMAGES_MAX) {
    return json({ error: `A collection can have ${COLLECTION_IMAGES_MAX} images.` }, 400);
  }

  const path = `${userId}/${collectionId}/${crypto.randomUUID()}.${imageExtension(file.type)}`;
  const body = Buffer.from(await file.arrayBuffer());
  try {
    await putR2Object(path, body, { contentType: file.type, cacheControl: "3600" });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Could not upload that photo." }, 500);
  }

  const { data, error } = await supabase
    .from("event_collection_images")
    .insert({ collection_id: collectionId, path, position })
    .select("id, path, position")
    .single();
  if (error) {
    await deleteR2Objects([path]).catch(() => undefined);
    return json({ error: collectionErrorMessage(error) }, 400);
  }
  return json(data);
}

export async function DELETE(request: Request) {
  if (!isAuthConfigured()) return json({ error: "Sign in to remove photos." }, 401);
  const claims = await getAuthClaims();
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (!userId) return json({ error: "Sign in to remove photos." }, 401);

  const body = (await request.json().catch(() => null)) as { paths?: unknown; id?: unknown } | null;
  const paths = Array.isArray(body?.paths) ? body.paths.filter((path): path is string => typeof path === "string") : [];
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id && !paths.length) return json({ error: "Nothing to remove." }, 400);

  const supabase = await createAuthServerClient();
  if (id) {
    const { data, error } = await supabase
      .from("event_collection_images")
      .select("id, path, collection_id")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return json({ error: "Could not update that collection. Try again." }, 403);
    const owner = await requireOwner(data.collection_id, userId);
    if (!owner) return json({ error: "Could not update that collection. Try again." }, 403);
    if (isR2Configured()) await deleteR2Objects([data.path]);
    const { error: deleteError } = await owner.from("event_collection_images").delete().eq("id", id);
    if (deleteError) return json({ error: collectionErrorMessage(deleteError) }, 400);
    return json({ ok: true });
  }

  const allowed = paths.filter((path) => path.startsWith(`${userId}/`));
  if (allowed.length !== paths.length) return json({ error: "Could not update that collection. Try again." }, 403);
  if (isR2Configured()) await deleteR2Objects(allowed);
  return json({ ok: true });
}
