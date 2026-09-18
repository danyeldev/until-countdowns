import { describe, expect, it } from "vitest";
import { isBrowserVisit } from "@/lib/request/visitor";

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

function h(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("isBrowserVisit", () => {
  it("accepts a browser navigation and a same-origin router fetch", () => {
    expect(isBrowserVisit(h({ "user-agent": CHROME, "sec-fetch-site": "none", "sec-fetch-mode": "navigate" }))).toBe(true);
    // A QuickSearch submit is a client-side navigation: RSC fetch, not a document load.
    expect(isBrowserVisit(h({ "user-agent": CHROME, "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", rsc: "1" }))).toBe(true);
  });

  it("ignores router prefetches even from a real browser", () => {
    expect(isBrowserVisit(h({ "user-agent": CHROME, "sec-fetch-site": "same-origin", "next-router-prefetch": "1" }))).toBe(false);
  });

  it("ignores crawlers, HTTP libraries and headless tooling", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)",
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.0.0 Safari/537.36",
      "python-requests/2.32",
      "curl/8.7.1",
      "Scrapy/2.11 (+https://scrapy.org)",
      "Mozilla/5.0 (compatible; DataForSeoBot/1.0)",
    ]) {
      expect(isBrowserVisit(h({ "user-agent": ua, "sec-fetch-site": "none" })), ua).toBe(false);
    }
  });

  it("ignores requests without a user agent or without Fetch Metadata", () => {
    expect(isBrowserVisit(h({ "sec-fetch-site": "none" }))).toBe(false);
    expect(isBrowserVisit(h({ "user-agent": CHROME }))).toBe(false);
    expect(isBrowserVisit(h({ "user-agent": CHROME, "accept-language": "es-AR" }))).toBe(false);
  });
});
