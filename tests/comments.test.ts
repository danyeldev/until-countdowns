import { describe, expect, it } from "vitest";
import {
  applyMention,
  commentErrorMessage,
  extractMentionHandles,
  mentionQueryAtCaret,
  parseCommentBody,
  parseCommentEventKey,
  formatCommentAge,
  sortCommentThreads,
  splitCommentBody,
  type EventComment,
} from "@/lib/comments";

function comment(partial: Partial<EventComment> & Pick<EventComment, "id">): EventComment {
  return {
    eventKey: "new-year-2027-01-01",
    parentId: null,
    body: "Hello",
    voteCount: 0,
    createdAt: "2026-09-15T20:00:00.000Z",
    author: { id: "u1", name: "Ada", handle: "ada" },
    voted: false,
    ...partial,
  };
}

describe("parseCommentEventKey", () => {
  it("accepts catalog and personal slugs", () => {
    expect(parseCommentEventKey("new-year-2027-01-01")).toBe("new-year-2027-01-01");
    expect(parseCommentEventKey("mine-birthday-2026-09-15")).toBe("mine-birthday-2026-09-15");
  });

  it("rejects share payloads and junk", () => {
    expect(parseCommentEventKey("share-abc")).toBeNull();
    expect(parseCommentEventKey("New Year")).toBeNull();
    expect(parseCommentEventKey("")).toBeNull();
  });
});

describe("parseCommentBody", () => {
  it("trims and keeps a short note", () => {
    expect(parseCommentBody("  See you there.  ")).toBe("See you there.");
  });

  it("rejects empty or oversized text", () => {
    expect(parseCommentBody("   ")).toBeNull();
    expect(parseCommentBody("x".repeat(2001))).toBeNull();
  });
});

describe("mentions", () => {
  it("extracts unique handles", () => {
    expect(extractMentionHandles("Hey @ada and @Ada and @login and @oak")).toEqual(["ada", "oak"]);
  });

  it("finds an @query at the caret", () => {
    expect(mentionQueryAtCaret("hi @ad", 6)).toEqual({ query: "ad", start: 3 });
    expect(mentionQueryAtCaret("mail@ada", 8)).toBeNull();
    expect(mentionQueryAtCaret("hi @ada more", 12)).toBeNull();
  });

  it("inserts a handle and moves the caret", () => {
    expect(applyMention("hi @ad", 3, 6, "ada")).toEqual({ body: "hi @ada ", caret: 8 });
  });

  it("turns handles into profile links", () => {
    expect(splitCommentBody("Ask @ada later.")).toEqual([
      { type: "text", value: "Ask " },
      { type: "mention", handle: "ada", href: "/ada" },
      { type: "text", value: " later." },
    ]);
  });
});

describe("formatCommentAge", () => {
  it("uses compact relative time", () => {
    const now = Date.parse("2026-09-16T12:00:00.000Z");
    expect(formatCommentAge("2026-09-16T11:59:20.000Z", now)).toBe("just now");
    expect(formatCommentAge("2026-09-16T11:49:00.000Z", now)).toBe("11m ago");
    expect(formatCommentAge("2026-09-16T03:00:00.000Z", now)).toBe("9h ago");
    expect(formatCommentAge("2026-09-14T12:00:00.000Z", now)).toBe("2d ago");
    expect(formatCommentAge("2026-08-01T12:00:00.000Z", now)).toBe("Aug 1");
  });
});

describe("sortCommentThreads", () => {
  it("sorts roots by votes, replies by time", () => {
    const threads = sortCommentThreads([
      comment({ id: "a", voteCount: 1, createdAt: "2026-09-15T10:00:00.000Z" }),
      comment({ id: "b", voteCount: 4, createdAt: "2026-09-15T09:00:00.000Z" }),
      comment({ id: "c", parentId: "b", createdAt: "2026-09-15T11:00:00.000Z", body: "later" }),
      comment({ id: "d", parentId: "b", createdAt: "2026-09-15T10:30:00.000Z", body: "sooner" }),
    ]);
    expect(threads.map((thread) => thread.root.id)).toEqual(["b", "a"]);
    expect(threads[0]?.replies.map((reply) => reply.id)).toEqual(["d", "c"]);
  });

  it("can sort roots newest first", () => {
    const threads = sortCommentThreads(
      [
        comment({ id: "a", voteCount: 1, createdAt: "2026-09-15T10:00:00.000Z" }),
        comment({ id: "b", voteCount: 4, createdAt: "2026-09-15T09:00:00.000Z" }),
      ],
      "newest",
    );
    expect(threads.map((thread) => thread.root.id)).toEqual(["a", "b"]);
  });
});

describe("commentErrorMessage", () => {
  it("maps known database errors", () => {
    expect(commentErrorMessage({ code: "P0001", message: "profile_incomplete" })).toBe(
      "Add a handle to your profile before commenting.",
    );
    expect(commentErrorMessage({ message: "comment_limit" })).toMatch(/limit/);
    expect(commentErrorMessage({ code: "42501" })).toMatch(/Sign in/);
  });
});
