"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { Icon } from "@/components/Icon";
import { SignInButton } from "@/components/SignInButton";
import { createAuthBrowserClient } from "@/lib/auth/browser";
import { isAuthConfigured } from "@/lib/auth/env";
import { completeProfileHref, safeNextPath } from "@/lib/auth/paths";
import { profileHref } from "@/lib/auth/profile";
import {
  COMMENT_BODY_MAX,
  type CommentSort,
  type EventComment,
  type HandleSuggestion,
  applyMention,
  formatCommentAge,
  mentionQueryAtCaret,
  parseCommentEventKey,
  rememberPendingComment,
  rememberPendingVote,
  resolveCommentThreadId,
  takePendingComment,
  takePendingVote,
  sortCommentThreads,
  splitCommentBody,
} from "@/lib/comments";
import {
  createEventComment,
  listEventComments,
  searchCommentHandles,
  toggleEventCommentVote,
} from "@/lib/comments-client";

const AVATAR_TONES = [
  "bg-[#2a3d36] text-moss",
  "bg-[#2f2a45] text-amber",
  "bg-[#3d2c2a] text-ember",
  "bg-[#243044] text-[#9ec5ff]",
  "bg-[#3a2f24] text-[#f0c48a]",
] as const;

function avatarTone(handle: string): string {
  let hash = 0;
  for (const char of handle) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length] ?? AVATAR_TONES[0];
}

function CommentAvatar({ name, handle }: { name: string; handle: string }) {
  const initial = (name.trim()[0] || handle[0] || "?").toLocaleUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${avatarTone(handle)}`}
    >
      {initial}
    </span>
  );
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

const COMMENT_AUTH = {
  heading: "Sign in to comment.",
  subtitle: "Use Google or your email. Then you can join this conversation.",
} as const;

const REPLY_AUTH = {
  heading: "Sign in to reply.",
  subtitle: "Use Google or your email. Then you can reply to this comment.",
} as const;

const VOTE_AUTH = {
  heading: "Sign in to upvote.",
  subtitle: "Use Google or your email. Then we’ll save your upvote.",
} as const;

function VoteControl({
  comment,
  signedIn,
  disabled,
  next,
  onToggle,
}: {
  comment: EventComment;
  signedIn: boolean;
  disabled: boolean;
  next: string;
  onToggle: (comment: EventComment) => void;
}) {
  const className = `inline-flex min-h-11 items-center gap-1.5 px-1 text-xs ${
    comment.voted ? "text-amber" : "text-muted hover:text-paper"
  }`;
  const inner = (
    <>
      <Icon name="heart" size={15} fill={comment.voted ? "currentColor" : "none"} />
      <span className="tabular">{comment.voteCount}</span>
    </>
  );
  if (!signedIn) {
    return (
      <SignInButton
        next={`${next}#comment-${comment.id}`}
        className={className}
        ariaLabel={`Upvote ${comment.author.handle}'s comment`}
        heading={VOTE_AUTH.heading}
        subtitle={VOTE_AUTH.subtitle}
        onOpen={() => rememberPendingVote(comment.id)}
      >
        {inner}
      </SignInButton>
    );
  }
  return (
    <button
      type="button"
      className={className}
      aria-pressed={comment.voted}
      aria-label={`${comment.voted ? "Remove upvote from" : "Upvote"} ${comment.author.handle}'s comment`}
      disabled={disabled}
      onClick={() => onToggle(comment)}
    >
      {inner}
    </button>
  );
}

function fitComposer(area: HTMLTextAreaElement) {
  area.style.height = "0px";
  area.style.height = `${Math.min(Math.max(area.scrollHeight, 24), 160)}px`;
}

function readCommentHash(): string | null {
  if (typeof window === "undefined") return null;
  const id = window.location.hash.replace(/^#/, "");
  if (!id.startsWith("comment-")) return null;
  return id.slice("comment-".length);
}

function Composer({
  eventKey,
  parentId,
  placeholder,
  onPosted,
  onCancel,
  autoFocus = false,
}: {
  eventKey: string;
  parentId?: string | null;
  placeholder: string;
  onPosted: (comment: EventComment) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState("");
  const [caret, setCaret] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<HandleSuggestion[]>([]);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const searchTimer = useRef<number | null>(null);
  const remaining = COMMENT_BODY_MAX - body.length;

  function rememberCaret(target: HTMLTextAreaElement) {
    setCaret(target.selectionStart);
    fitComposer(target);
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
      fitComposer(area);
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
      if (areaRef.current) fitComposer(areaRef.current);
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
      <div className="field flex items-end gap-2 !px-2 !py-1.5">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{placeholder}</span>
          <textarea
            ref={areaRef}
            rows={1}
            className="block max-h-40 min-h-10 w-full resize-none bg-transparent px-2 py-2 text-sm leading-relaxed text-paper outline-none"
            maxLength={COMMENT_BODY_MAX}
            placeholder={placeholder}
            autoFocus={autoFocus}
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
        <button
          type="submit"
          className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-amber text-[#171222] disabled:bg-surface-hover disabled:text-muted"
          disabled={pending || !body.trim()}
          aria-label={parentId ? "Post reply" : "Post comment"}
        >
          <Icon name="send" size={16} />
        </button>
      </div>
      {suggestions.length ? (
        <ul
          role="listbox"
          aria-label="Mention someone"
          className="menu absolute z-20 mt-2 w-full overflow-hidden"
        >
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                className="menu-item justify-between"
                onClick={() => chooseMention(item.handle)}
              >
                <span className="text-paper">{item.name}</span>
                <span className="text-xs text-muted">@{item.handle}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 px-1">
        {remaining < 200 ? <p className="pt-2 text-xs text-muted">{remaining} left</p> : null}
        {onCancel ? (
          <button type="button" className="min-h-11 text-xs text-muted hover:text-paper" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 px-1 text-xs leading-relaxed text-ember">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function ComposerGate({
  ready,
  userId,
  handle,
  eventKey,
  next,
  completeHref,
  children,
}: {
  ready: boolean;
  userId: string | null;
  handle: string | null;
  eventKey: string;
  next: string;
  completeHref: string;
  children: ReactNode;
}) {
  if (!ready) {
    return (
      <p className="field flex items-center text-sm text-muted">
        Opening comments…
      </p>
    );
  }
  if (!userId) {
    return (
      <SignInButton
        next={next}
        className="field flex items-center text-start text-sm text-muted hover:text-paper"
        heading={COMMENT_AUTH.heading}
        subtitle={COMMENT_AUTH.subtitle}
        onOpen={() => rememberPendingComment(eventKey)}
      >
        Add a comment...
      </SignInButton>
    );
  }
  if (!handle) {
    return (
      <Link
        href={completeHref}
        className="field flex items-center text-sm text-muted hover:text-paper"
      >
        Add a handle to join
      </Link>
    );
  }
  return children;
}

function CommentItem({
  comment,
  eventKey,
  signedIn,
  pendingVote,
  next,
  onVote,
  onReply,
  children,
}: {
  comment: EventComment;
  eventKey: string;
  signedIn: boolean;
  pendingVote: string | null;
  next: string;
  onVote: (comment: EventComment) => void;
  onReply?: () => void;
  children?: ReactNode;
}) {
  return (
    <article id={`comment-${comment.id}`} className="scroll-mt-24 rounded-xl py-1 target:bg-amber/[.06]">
      <div className="flex gap-3">
        <CommentAvatar name={comment.author.name} handle={comment.author.handle} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <Link href={profileHref(comment.author.handle)} className="font-medium text-paper hover:text-amber">
              {comment.author.handle}
            </Link>
            <time className="text-xs text-muted" dateTime={comment.createdAt}>
              {formatCommentAge(comment.createdAt)}
            </time>
          </p>
          <div className="mt-1">
            <CommentText body={comment.body} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center">
            <VoteControl
              comment={comment}
              signedIn={signedIn}
              disabled={pendingVote === comment.id}
              next={next}
              onToggle={onVote}
            />
            {!signedIn ? (
              <SignInButton
                next={`${next}#comment-${comment.parentId ?? comment.id}`}
                className="min-h-11 px-2 text-xs text-muted hover:text-paper"
                heading={REPLY_AUTH.heading}
                subtitle={REPLY_AUTH.subtitle}
                onOpen={() => rememberPendingComment(eventKey, comment.parentId ?? comment.id)}
              >
                Reply
              </SignInButton>
            ) : onReply ? (
              <button type="button" className="min-h-11 px-2 text-xs text-muted hover:text-paper" onClick={onReply}>
                Reply
              </button>
            ) : null}
          </div>
          {children}
        </div>
      </div>
    </article>
  );
}

export function EventComments({ eventKey }: { eventKey: string }) {
  const pathname = usePathname();
  const configured = isAuthConfigured();
  const { ready, userId } = useCollection();
  const key = parseCommentEventKey(eventKey);
  const next = safeNextPath(pathname);
  const completeHref = completeProfileHref(next);

  const [comments, setComments] = useState<EventComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [profileHandle, setProfileHandle] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [pendingVote, setPendingVote] = useState<string | null>(null);
  const [voteError, setVoteError] = useState("");
  const [order, setOrder] = useState<CommentSort>("newest");
  const [openReplies, setOpenReplies] = useState<ReadonlySet<string>>(() => new Set());
  const [closedReplies, setClosedReplies] = useState<ReadonlySet<string>>(() => new Set());
  const [hashId] = useState(readCommentHash);
  const [focusComposer, setFocusComposer] = useState(false);
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
    if (!loaded || !hashId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`comment-${hashId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loaded, hashId]);

  useEffect(() => {
    if (!ready || !userId || !key || !loaded || !handle) return;
    const pending = takePendingComment();
    if (!pending) return;
    if (pending.eventKey !== key) {
      rememberPendingComment(pending.eventKey, pending.parentId);
      return;
    }
    const threadId = pending.parentId ? resolveCommentThreadId(comments, pending.parentId) : null;
    if (pending.parentId && !threadId) return;
    void Promise.resolve().then(() => {
      if (!threadId) {
        setFocusComposer(true);
        return;
      }
      setReplyTo(threadId);
      setOpenReplies((current) => new Set(current).add(threadId));
      setClosedReplies((current) => {
        const nextClosed = new Set(current);
        nextClosed.delete(threadId);
        return nextClosed;
      });
      window.requestAnimationFrame(() => {
        document.getElementById(`comment-${threadId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }, [comments, handle, key, loaded, ready, userId]);

  useEffect(() => {
    if (!ready || !userId || !loaded) return;
    const id = takePendingVote();
    if (!id) return;
    const comment = comments.find((item) => item.id === id);
    if (!comment || comment.voted) return;
    void Promise.resolve().then(() => {
      setPendingVote(comment.id);
      setVoteError("");
      void toggleEventCommentVote(createAuthBrowserClient(), comment)
        .then((nextComment) => {
          setComments((current) => current.map((item) => (item.id === nextComment.id ? nextComment : item)));
        })
        .catch((cause) => {
          setVoteError(cause instanceof Error ? cause.message : "Could not save that vote.");
        })
        .finally(() => setPendingVote(null));
    });
  }, [comments, loaded, ready, userId]);

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

  const threads = useMemo(() => sortCommentThreads(comments, order), [comments, order]);
  const hashThreadId = useMemo(() => {
    if (!hashId) return null;
    return comments.find((item) => item.id === hashId)?.parentId ?? null;
  }, [comments, hashId]);
  const canWrite = Boolean(userId && handle);

  function repliesOpen(id: string): boolean {
    if (closedReplies.has(id)) return false;
    return openReplies.has(id) || replyTo === id || hashThreadId === id;
  }

  function addComment(comment: EventComment) {
    setComments((current) => [...current.filter((item) => item.id !== comment.id), comment]);
    setReplyTo(null);
    if (comment.parentId) {
      const threadId = comment.parentId;
      setOpenReplies((current) => new Set(current).add(threadId));
      setClosedReplies((current) => {
        const next = new Set(current);
        next.delete(threadId);
        return next;
      });
    }
  }

  function startReply(id: string) {
    setReplyTo(id);
    setOpenReplies((current) => new Set(current).add(id));
    setClosedReplies((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function toggleReplies(id: string) {
    if (repliesOpen(id)) {
      setClosedReplies((current) => new Set(current).add(id));
      setOpenReplies((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      if (replyTo === id) setReplyTo(null);
      return;
    }
    setOpenReplies((current) => new Set(current).add(id));
    setClosedReplies((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
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
    <section className="hairline mt-12 max-w-3xl pt-10" aria-labelledby="event-comments-heading">
      <h2 id="event-comments-heading" className="section-heading">
        Comments
        {loaded ? <span className="text-muted"> ({comments.length.toLocaleString()})</span> : null}
      </h2>

      <div className="mt-4">
        <ComposerGate
          ready={ready}
          userId={userId}
          handle={handle}
          eventKey={key}
          next={next}
          completeHref={completeHref}
        >
          <Composer eventKey={key} placeholder="Add a comment..." autoFocus={focusComposer} onPosted={addComment} />
        </ComposerGate>
      </div>

      {loadError ? (
        <p role="alert" className="mt-4 text-sm text-ember">
          {loadError}
        </p>
      ) : null}
      {voteError ? (
        <p role="alert" className="mt-4 text-sm text-ember">
          {voteError}
        </p>
      ) : null}

      {loaded && threads.length ? (
        <div className="relative mt-2 inline-flex items-center">
          <label className="sr-only" htmlFor="comment-sort">
            Sort comments
          </label>
          <select
            id="comment-sort"
            className="min-h-11 appearance-none bg-transparent py-2 pr-7 text-sm text-muted"
            value={order}
            onChange={(event) => setOrder(event.target.value as CommentSort)}
          >
            <option value="newest">Newest</option>
            <option value="top">Top</option>
          </select>
          <Icon name="chevron" size={14} className="pointer-events-none absolute right-0 text-muted" />
        </div>
      ) : null}

      {loaded && !threads.length && !loadError ? (
        <p className="mt-6 text-sm text-muted">No comments yet.</p>
      ) : null}

      <ol className="mt-2">
        {threads.map(({ root, replies }) => {
          const open = repliesOpen(root.id);
          const replyLabel = replies.length === 1 ? "1 reply" : `${replies.length} replies`;
          return (
            <li key={root.id} className="py-4">
              <CommentItem
                comment={root}
                eventKey={key}
                signedIn={Boolean(userId)}
                pendingVote={pendingVote}
                next={next}
                onVote={onVote}
                onReply={canWrite ? () => startReply(root.id) : undefined}
              >
                {replies.length ? (
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-1 text-xs text-muted hover:text-paper"
                    aria-expanded={open}
                    onClick={() => toggleReplies(root.id)}
                  >
                    {replyLabel}
                    <Icon name="chevron" size={14} className={open ? "rotate-180" : ""} />
                  </button>
                ) : null}
                {open && replies.length ? (
                  <ol className="mt-3 space-y-4">
                    {replies.map((reply) => (
                      <li key={reply.id}>
                        <CommentItem
                          comment={reply}
                          eventKey={key}
                          signedIn={Boolean(userId)}
                          pendingVote={pendingVote}
                          next={next}
                          onVote={onVote}
                          onReply={canWrite ? () => startReply(root.id) : undefined}
                        />
                      </li>
                    ))}
                  </ol>
                ) : null}
                {replyTo === root.id && canWrite ? (
                  <div className="mt-3">
                    <Composer
                      eventKey={key}
                      parentId={root.id}
                      placeholder={`Reply to @${root.author.handle}`}
                      autoFocus
                      onPosted={addComment}
                      onCancel={() => setReplyTo(null)}
                    />
                  </div>
                ) : null}
              </CommentItem>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
