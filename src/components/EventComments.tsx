"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { createAuthBrowserClient } from "@/lib/auth/browser";
import { isAuthConfigured } from "@/lib/auth/env";
import { completeProfileHref, loginHref, safeNextPath } from "@/lib/auth/paths";
import { profileHref } from "@/lib/auth/profile";
import {
  COMMENT_BODY_MAX,
  type EventComment,
  type HandleSuggestion,
  applyMention,
  mentionQueryAtCaret,
  parseCommentEventKey,
  sortCommentThreads,
  splitCommentBody,
} from "@/lib/comments";
import {
  createEventComment,
  listEventComments,
  searchCommentHandles,
  toggleEventCommentVote,
} from "@/lib/comments-client";

function formatCommentTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function CommentText({ body }: { body: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-paper-dim">
      {splitCommentBody(body).map((part, index) =>
        part.type === "mention" ? (
          <Link key={`${part.handle}-${index}`} href={part.href} className="font-medium text-amber hover:underline">
            @{part.handle}
          </Link>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </p>
  );
}

function VoteButton({
  comment,
  disabled,
  onToggle,
}: {
  comment: EventComment;
  disabled: boolean;
  onToggle: (comment: EventComment) => void;
}) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-xs transition-colors ${
        comment.voted
          ? "border-amber/50 text-amber"
          : "border-line text-paper-dim hover:border-amber/40 hover:text-amber"
      }`}
      aria-pressed={comment.voted}
      aria-label={`${comment.voted ? "Remove upvote from" : "Upvote"} ${comment.author.handle}'s comment`}
      disabled={disabled}
      onClick={() => onToggle(comment)}
    >
      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill={comment.voted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="m6 14 6-8 6 8" />
      </svg>
      {comment.voteCount}
    </button>
  );
}

function Composer({
  eventKey,
  parentId,
  placeholder,
  onPosted,
  onCancel,
}: {
  eventKey: string;
  parentId?: string | null;
  placeholder: string;
  onPosted: (comment: EventComment) => void;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState("");
  const [caret, setCaret] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<HandleSuggestion[]>([]);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const searchTimer = useRef<number | null>(null);

  function rememberCaret(target: HTMLTextAreaElement) {
    setCaret(target.selectionStart);
  }

  function updateMentions(nextBody: string, nextCaret: number) {
    const found = mentionQueryAtCaret(nextBody, nextCaret);
    setMention(found);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    if (!found) {
      setSuggestions([]);
      return;
    }
    searchTimer.current = window.setTimeout(() => {
      const client = createAuthBrowserClient();
      void searchCommentHandles(client, found.query)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 160);
  }

  function chooseMention(handle: string) {
    if (!mention) return;
    const next = applyMention(body, mention.start, caret, handle);
    setBody(next.body);
    setCaret(next.caret);
    setMention(null);
    setSuggestions([]);
    requestAnimationFrame(() => {
      const area = areaRef.current;
      if (!area) return;
      area.focus();
      area.setSelectionRange(next.caret, next.caret);
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const comment = await createEventComment(createAuthBrowserClient(), {
        eventKey,
        body,
        parentId,
      });
      setBody("");
      setSuggestions([]);
      setMention(null);
      onPosted(comment);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not post that comment. Try again.");
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
    if (event.key === "Escape" && onCancel) onCancel();
  }

  return (
    <form onSubmit={onSubmit} className="relative">
      <label className="block">
        <span className="sr-only">{placeholder}</span>
        <textarea
          ref={areaRef}
          className="field min-h-28 resize-y"
          maxLength={COMMENT_BODY_MAX}
          placeholder={placeholder}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            rememberCaret(event.target);
            updateMentions(event.target.value, event.target.selectionStart);
          }}
          onSelect={(event) => rememberCaret(event.currentTarget)}
          onKeyUp={(event) => rememberCaret(event.currentTarget)}
          onKeyDown={onKeyDown}
        />
      </label>
      {suggestions.length ? (
        <ul
          role="listbox"
          aria-label="Mention someone"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-ink shadow-lg"
        >
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-surface-hover"
                onClick={() => chooseMention(item.handle)}
              >
                <span className="text-paper">{item.name}</span>
                <span className="text-xs text-muted">@{item.handle}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {body.length}/{COMMENT_BODY_MAX}. Type @ to tag someone.
        </p>
        <div className="flex flex-wrap gap-2">
          {onCancel ? (
            <button type="button" className="button-secondary" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
          <button type="submit" className="button-primary" disabled={pending || !body.trim()}>
            {parentId ? "Reply" : "Post comment"}
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-line bg-ink px-3 py-2 text-xs leading-relaxed text-paper">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function CommentCard({
  comment,
  canWrite,
  signedIn,
  loginHrefValue,
  pendingVote,
  onVote,
  onReply,
  children,
}: {
  comment: EventComment;
  canWrite: boolean;
  signedIn: boolean;
  loginHrefValue: string;
  pendingVote: string | null;
  onVote: (comment: EventComment) => void;
  onReply?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <article
      id={`comment-${comment.id}`}
      className="rounded-2xl border border-line bg-ink px-4 py-4 sm:px-5 target:border-amber/50"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-paper">
          <Link href={profileHref(comment.author.handle)} className="font-medium hover:text-amber">
            {comment.author.name}
          </Link>{" "}
          <Link href={profileHref(comment.author.handle)} className="text-muted hover:text-amber">
            @{comment.author.handle}
          </Link>
        </p>
        <time className="text-xs text-muted" dateTime={comment.createdAt}>
          {formatCommentTime(comment.createdAt)}
        </time>
      </div>
      <div className="mt-3">
        <CommentText body={comment.body} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {signedIn ? (
          <VoteButton comment={comment} disabled={pendingVote === comment.id} onToggle={onVote} />
        ) : (
          <Link href={loginHrefValue} className="button-secondary !min-h-11 !px-3 !text-xs">
            Sign in to upvote
          </Link>
        )}
        {canWrite && onReply ? (
          <button type="button" className="button-secondary !min-h-11 !px-3 !text-xs" onClick={onReply}>
            Reply
          </button>
        ) : null}
      </div>
      {children}
    </article>
  );
}

export function EventComments({ eventKey }: { eventKey: string }) {
  const pathname = usePathname();
  const configured = isAuthConfigured();
  const { ready, userId } = useCollection();
  const key = parseCommentEventKey(eventKey);
  const next = safeNextPath(pathname);
  const signInHref = loginHref(next);
  const completeHref = completeProfileHref(next);

  const [comments, setComments] = useState<EventComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [profileHandle, setProfileHandle] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [pendingVote, setPendingVote] = useState<string | null>(null);
  const [voteError, setVoteError] = useState("");
  const handle = userId ? profileHandle : null;

  useEffect(() => {
    if (!configured || !key) return;
    let cancelled = false;
    void listEventComments(createAuthBrowserClient(), key)
      .then((rows) => {
        if (cancelled) return;
        setComments(rows);
        setLoadError("");
        setLoaded(true);
      })
      .catch((cause) => {
        if (cancelled) return;
        setLoadError(cause instanceof Error ? cause.message : "Could not load comments.");
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, key, userId]);

  useEffect(() => {
    if (!loaded) return;
    const id = window.location.hash.replace(/^#/, "");
    if (!id.startsWith("comment-")) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loaded, comments.length]);

  useEffect(() => {
    if (!configured || !userId) return;
    let cancelled = false;
    void createAuthBrowserClient()
      .from("profiles")
      .select("handle")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfileHandle(data?.handle ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, userId]);

  const threads = useMemo(() => sortCommentThreads(comments), [comments]);
  const canWrite = Boolean(userId && handle);

  function addComment(comment: EventComment) {
    setComments((current) => [...current.filter((item) => item.id !== comment.id), comment]);
    setReplyTo(null);
  }

  async function onVote(comment: EventComment) {
    setPendingVote(comment.id);
    setVoteError("");
    try {
      const nextComment = await toggleEventCommentVote(createAuthBrowserClient(), comment);
      setComments((current) => current.map((item) => (item.id === nextComment.id ? nextComment : item)));
    } catch (cause) {
      setVoteError(cause instanceof Error ? cause.message : "Could not save that vote.");
    } finally {
      setPendingVote(null);
    }
  }

  if (!key || !configured) return null;

  return (
    <section className="mt-10" aria-labelledby="event-comments-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="event-comments-heading" className="section-heading">
            Conversation
          </h2>
          <p className="mt-1 text-sm text-muted">
            {loaded ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Loading comments…"}
          </p>
        </div>
      </div>

      <div className="panel mt-5 rounded-2xl border border-line bg-ink-2 p-5 sm:p-6">
        {!ready ? (
          <p className="text-sm text-muted">Opening comments…</p>
        ) : !userId ? (
          <p className="text-sm leading-relaxed text-paper-dim">
            <Link href={signInHref} className="text-amber hover:underline">
              Sign in
            </Link>{" "}
            to comment, reply, tag someone, or upvote.
          </p>
        ) : !handle ? (
          <p className="text-sm leading-relaxed text-paper-dim">
            <Link href={completeHref} className="text-amber hover:underline">
              Add a handle
            </Link>{" "}
            to join the conversation.
          </p>
        ) : (
          <Composer eventKey={key} placeholder="Share a thought, or tag someone with @handle." onPosted={addComment} />
        )}
      </div>

      {loadError ? (
        <p role="alert" className="mt-4 rounded-xl border border-line bg-ink-2 px-4 py-3 text-sm text-paper">
          {loadError}
        </p>
      ) : null}
      {voteError ? (
        <p role="alert" className="mt-4 rounded-xl border border-line bg-ink-2 px-4 py-3 text-sm text-paper">
          {voteError}
        </p>
      ) : null}

      {loaded && !threads.length && !loadError ? (
        <p className="mt-5 text-sm text-muted">No comments yet. Be the first.</p>
      ) : null}

      <ol className="mt-5 space-y-4">
        {threads.map(({ root, replies }) => (
          <li key={root.id}>
            <CommentCard
              comment={root}
              canWrite={canWrite}
              signedIn={Boolean(userId)}
              loginHrefValue={signInHref}
              pendingVote={pendingVote}
              onVote={onVote}
              onReply={canWrite ? () => setReplyTo(root.id) : undefined}
            >
              {replyTo === root.id && canWrite ? (
                <div className="mt-4 border-t border-line pt-4">
                  <Composer
                    eventKey={key}
                    parentId={root.id}
                    placeholder={`Reply to @${root.author.handle}`}
                    onPosted={addComment}
                    onCancel={() => setReplyTo(null)}
                  />
                </div>
              ) : null}
            </CommentCard>
            {replies.length ? (
              <ol className="mt-3 space-y-3 border-l border-line pl-4 sm:ml-4">
                {replies.map((reply) => (
                  <li key={reply.id}>
                    <CommentCard
                      comment={reply}
                      canWrite={canWrite}
                      signedIn={Boolean(userId)}
                      loginHrefValue={signInHref}
                      pendingVote={pendingVote}
                      onVote={onVote}
                    />
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
