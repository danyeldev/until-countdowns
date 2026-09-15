import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import {
  COMMENT_MENTION_MAX,
  COMMENTS_PER_EVENT_MAX,
  type EventComment,
  type HandleSuggestion,
  commentErrorMessage,
  extractMentionHandles,
  parseCommentBody,
  parseCommentEventKey,
} from "./comments";

type CommentClient = SupabaseClient<Database>;

type CommentRow = {
  id: string;
  event_key: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  vote_count: number;
  created_at: string;
  profiles: { name: string; handle: string | null } | { name: string; handle: string | null }[] | null;
};

function authorFromRow(row: CommentRow): EventComment["author"] | null {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const handle = profile?.handle?.trim() || "";
  if (!handle) return null;
  return {
    id: row.author_id,
    name: profile?.name?.trim() || handle,
    handle,
  };
}

function commentFromRow(row: CommentRow, voted: Set<string>): EventComment | null {
  const author = authorFromRow(row);
  if (!author) return null;
  return {
    id: row.id,
    eventKey: row.event_key,
    parentId: row.parent_id,
    body: row.body,
    voteCount: row.vote_count,
    createdAt: row.created_at,
    author,
    voted: voted.has(row.id),
  };
}

export async function listEventComments(client: CommentClient, eventKey: string): Promise<EventComment[]> {
  const key = parseCommentEventKey(eventKey);
  if (!key) return [];
  const { data, error } = await client
    .from("event_comments")
    .select("id, event_key, author_id, parent_id, body, vote_count, created_at, profiles!event_comments_author_id_fkey(name, handle)")
    .eq("event_key", key)
    .order("created_at", { ascending: true })
    .limit(COMMENTS_PER_EVENT_MAX);
  if (error) throw new Error(commentErrorMessage(error));
  const rows = (data ?? []) as CommentRow[];
  const ids = rows.map((row) => row.id);
  const voted = new Set<string>();
  if (ids.length) {
    const { data: votes } = await client.from("event_comment_votes").select("comment_id").in("comment_id", ids);
    for (const vote of votes ?? []) voted.add(vote.comment_id);
  }
  return rows.flatMap((row) => {
    const comment = commentFromRow(row, voted);
    return comment ? [comment] : [];
  });
}

export async function searchCommentHandles(client: CommentClient, query: string): Promise<HandleSuggestion[]> {
  const needle = query.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
  if (!needle) return [];
  const { data, error } = await client
    .from("profiles")
    .select("id, name, handle")
    .not("handle", "is", null)
    .ilike("handle", `${needle}%`)
    .order("handle")
    .limit(8);
  if (error) throw new Error(commentErrorMessage(error));
  return (data ?? []).flatMap((row) => {
    if (!row.handle) return [];
    return [{ id: row.id, name: row.name?.trim() || row.handle, handle: row.handle }];
  });
}

export async function createEventComment(
  client: CommentClient,
  input: { eventKey: string; body: string; parentId?: string | null },
): Promise<EventComment> {
  const eventKey = parseCommentEventKey(input.eventKey);
  const body = parseCommentBody(input.body);
  if (!eventKey) throw new Error("This countdown cannot collect comments.");
  if (!body) throw new Error("Write a comment before posting.");

  const { data, error } = await client
    .from("event_comments")
    .insert({
      event_key: eventKey,
      body,
      parent_id: input.parentId || null,
    })
    .select("id, event_key, author_id, parent_id, body, vote_count, created_at, profiles!event_comments_author_id_fkey(name, handle)")
    .single();
  if (error) throw new Error(commentErrorMessage(error));
  const comment = commentFromRow(data as CommentRow, new Set());
  if (!comment) throw new Error("Could not post that comment. Try again.");

  const handles = extractMentionHandles(body);
  if (handles.length) {
    const { data: profiles } = await client
      .from("profiles")
      .select("id, handle")
      .in("handle", handles)
      .not("handle", "is", null)
      .limit(COMMENT_MENTION_MAX);
    const mentions = (profiles ?? []).flatMap((profile) =>
      profile.id === comment.author.id ? [] : [{ comment_id: comment.id, profile_id: profile.id }],
    );
    if (mentions.length) {
      const { error: mentionError } = await client.from("event_comment_mentions").insert(mentions);
      if (mentionError) throw new Error(commentErrorMessage(mentionError));
    }
  }
  return comment;
}

export async function toggleEventCommentVote(
  client: CommentClient,
  comment: EventComment,
): Promise<EventComment> {
  if (comment.voted) {
    const { error } = await client
      .from("event_comment_votes")
      .delete()
      .eq("comment_id", comment.id);
    if (error) throw new Error(commentErrorMessage(error));
    return { ...comment, voted: false, voteCount: Math.max(0, comment.voteCount - 1) };
  }
  const { error } = await client.from("event_comment_votes").insert({ comment_id: comment.id });
  if (error) throw new Error(commentErrorMessage(error));
  return { ...comment, voted: true, voteCount: comment.voteCount + 1 };
}
