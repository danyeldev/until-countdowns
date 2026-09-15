import { parseHandle, profileHref } from "@/lib/auth/profile";
import { isCatalogEventId } from "./event-id";
import { isPersonalSlug } from "./user-events";

export const COMMENT_BODY_MAX = 2000;
export const COMMENT_MENTION_MAX = 10;
export const COMMENTS_PER_EVENT_MAX = 200;

const MENTION_PATTERN = /@([a-z][a-z0-9_]{2,19})\b/gi;

export type CommentAuthor = {
  id: string;
  name: string;
  handle: string;
};

export type EventComment = {
  id: string;
  eventKey: string;
  parentId: string | null;
  body: string;
  voteCount: number;
  createdAt: string;
  author: CommentAuthor;
  voted: boolean;
};

export type CommentThread = {
  root: EventComment;
  replies: EventComment[];
};

export type HandleSuggestion = {
  id: string;
  name: string;
  handle: string;
};

export function parseCommentEventKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (isPersonalSlug(value)) return value;
  if (isCatalogEventId(value)) return value;
  return null;
}

export function parseCommentBody(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const body = value.replace(/\r\n/g, "\n").trim();
  if (!body || body.length > COMMENT_BODY_MAX) return null;
  return body;
}

export function extractMentionHandles(body: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const matches = body.matchAll(new RegExp(MENTION_PATTERN.source, "gi"));
  for (const match of matches) {
    const handle = parseHandle(match[1]);
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    found.push(handle);
    if (found.length >= COMMENT_MENTION_MAX) break;
  }
  return found;
}

export function mentionQueryAtCaret(body: string, caret: number): { query: string; start: number } | null {
  const head = body.slice(0, Math.max(0, caret));
  const at = head.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && /[a-z0-9_]/i.test(head[at - 1] ?? "")) return null;
  const typed = head.slice(at + 1);
  if (typed.includes(" ") || typed.includes("\n")) return null;
  if (!/^[a-z0-9_]*$/i.test(typed)) return null;
  return { query: typed.toLowerCase(), start: at };
}

export function applyMention(body: string, start: number, caret: number, handle: string): { body: string; caret: number } {
  const parsed = parseHandle(handle);
  if (!parsed) return { body, caret };
  const insert = `@${parsed} `;
  const next = `${body.slice(0, start)}${insert}${body.slice(caret)}`;
  return { body: next, caret: start + insert.length };
}

export type CommentBodyPart =
  | { type: "text"; value: string }
  | { type: "mention"; handle: string; href: string };

export function splitCommentBody(body: string): CommentBodyPart[] {
  const parts: CommentBodyPart[] = [];
  const re = new RegExp(MENTION_PATTERN.source, "gi");
  let cursor = 0;
  for (const match of body.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ type: "text", value: body.slice(cursor, index) });
    const handle = parseHandle(match[1]);
    if (handle) parts.push({ type: "mention", handle, href: profileHref(handle) });
    else parts.push({ type: "text", value: match[0] });
    cursor = index + match[0].length;
  }
  if (cursor < body.length) parts.push({ type: "text", value: body.slice(cursor) });
  return parts.length ? parts : [{ type: "text", value: body }];
}

export function sortCommentThreads(comments: EventComment[]): CommentThread[] {
  const replies = new Map<string, EventComment[]>();
  const roots: EventComment[] = [];
  for (const comment of comments) {
    if (comment.parentId) {
      const list = replies.get(comment.parentId) ?? [];
      list.push(comment);
      replies.set(comment.parentId, list);
    } else {
      roots.push(comment);
    }
  }
  roots.sort((left, right) => {
    if (right.voteCount !== left.voteCount) return right.voteCount - left.voteCount;
    return right.createdAt.localeCompare(left.createdAt);
  });
  for (const list of replies.values()) {
    list.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }
  return roots.map((root) => ({ root, replies: replies.get(root.id) ?? [] }));
}

export function commentErrorMessage(error: { message?: string; code?: string } | string | null | undefined): string {
  if (!error) return "Could not post that comment. Try again.";
  const message = typeof error === "string" ? error : error.message?.trim() || "";
  const code = typeof error === "string" ? "" : error.code?.trim() || "";
  if (code === "P0001" || /profile_incomplete/.test(message)) return "Add a handle to your profile before commenting.";
  if (/comment_limit/.test(message)) return "You have reached the comment limit on this countdown.";
  if (/comment_reply_depth|comment_parent/.test(message)) return "Reply to the original comment instead.";
  if (code === "42501" || /not authenticated|JWT/i.test(message)) return "Sign in to join the conversation.";
  if (message && message.length < 160 && !/https?:\/\//i.test(message) && !/regular expression|permission denied|violates/i.test(message)) {
    return message;
  }
  return "Could not post that comment. Try again.";
}
