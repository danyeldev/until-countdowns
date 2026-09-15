import { describe, expect, it } from "vitest";
import { parseHandle } from "@/lib/auth/profile";
import {
  notificationCopy,
  notificationHref,
  parseNotificationKind,
  previewCommentBody,
  unreadNotificationCount,
  type UserNotification,
} from "@/lib/notifications";

function item(partial: Partial<UserNotification> & Pick<UserNotification, "id">): UserNotification {
  return {
    kind: "comment_reply",
    eventKey: "halloween-2026-10-31",
    commentId: "c1",
    preview: "Hello",
    createdAt: "2026-09-15T20:00:00.000Z",
    readAt: null,
    actor: { id: "u1", name: "Ada", handle: "ada" },
    ...partial,
  };
}

describe("notification helpers", () => {
  it("builds an event deep link and rejects junk keys", () => {
    expect(notificationHref("halloween-2026-10-31", "abc")).toBe("/event/halloween-2026-10-31#comment-abc");
    expect(notificationHref("mine-birthday-2026-09-15", "abc")).toBe("/event/mine-birthday-2026-09-15#comment-abc");
    expect(notificationHref("share-abc", "abc")).toBe("/notifications");
  });

  it("names reply and mention copy", () => {
    expect(notificationCopy("comment_reply", "Ada")).toBe("Ada replied to your comment");
    expect(notificationCopy("comment_mention", "Oak")).toBe("Oak mentioned you");
  });

  it("counts unread rows and trims a preview", () => {
    expect(unreadNotificationCount([item({ id: "a" }), item({ id: "b", readAt: "2026-09-15T21:00:00.000Z" })])).toBe(1);
    expect(previewCommentBody("  Can't wait @ada  ")).toBe("Can't wait @ada");
    expect(previewCommentBody("x".repeat(200)).endsWith("…")).toBe(true);
  });

  it("accepts known kinds only", () => {
    expect(parseNotificationKind("comment_mention")).toBe("comment_mention");
    expect(parseNotificationKind("comment_vote")).toBeNull();
  });

  it("reserves the notifications handle", () => {
    expect(parseHandle("notifications")).toBeNull();
  });
});
