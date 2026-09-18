import { describe, expect, it } from "vitest";
import { crawlTrapDisallows, englishDetour, isBlockedCrawl, isCrawlTrap, LOCALE_URL_PREFIXES } from "@/lib/request/crawlers";
import { isAutomationUserAgent } from "@/lib/request/visitor";

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

function h(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("crawl traps", () => {
  it("covers every non-English locale prefix and search, in any locale", () => {
    expect(LOCALE_URL_PREFIXES).toHaveLength(26);
    expect(LOCALE_URL_PREFIXES).toContain("zh-hant");
    expect(LOCALE_URL_PREFIXES).not.toContain("en");
    for (const path of ["/es", "/es/", "/es/event/new-year", "/zh-hant/days-until/x", "/ZH/tag/y", "/search", "/es/search"]) {
      expect(isCrawlTrap(path), path).toBe(true);
    }
  });

  it("leaves the English catalog, profiles and machine endpoints alone", () => {
    for (const path of ["/", "/event/new-year", "/days-until/x", "/esteban", "/searchparty", "/api/ics/x", "/og/event/x.png", "/sitemap/hubs.xml"]) {
      expect(isCrawlTrap(path), path).toBe(false);
    }
  });

  it("emits a page line and an anchored home line per locale prefix", () => {
    const lines = crawlTrapDisallows();
    expect(lines[0]).toBe("/search");
    expect(lines).toEqual(expect.arrayContaining(["/es/", "/es$", "/zh-hant/", "/zh-hant$"]));
    expect(lines).toHaveLength(1 + 26 * 2);
  });
});

describe("isAutomationUserAgent", () => {
  it("flags crawlers, HTTP libraries and missing user agents", () => {
    for (const ua of [GOOGLEBOT, "Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)", "python-requests/2.32", "curl/8.7.1", "GPTBot/1.2", ""]) {
      expect(isAutomationUserAgent(ua), ua || "(empty)").toBe(true);
    }
    expect(isAutomationUserAgent(null)).toBe(true);
  });

  it("lets browsers and link unfurlers through", () => {
    for (const ua of [
      CHROME,
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      // A phone brand, not a bot.
      "Mozilla/5.0 (Linux; Android 13; CUBOT KINGKONG 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Twitterbot/1.0",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
      "WhatsApp/2.23.20.0",
    ]) {
      expect(isAutomationUserAgent(ua), ua).toBe(false);
    }
  });
});

describe("isBlockedCrawl", () => {
  it("refuses a crawler on a trap path or on its way into one", () => {
    expect(isBlockedCrawl(h({ "user-agent": GOOGLEBOT }), "/es/event/new-year")).toBe(true);
    expect(isBlockedCrawl(h({ "user-agent": GOOGLEBOT }), "/search")).toBe(true);
    expect(isBlockedCrawl(h({}), "/ja/tag/anime")).toBe(true);
    // `/?q=x` is about to be redirected into `/search`.
    expect(isBlockedCrawl(h({ "user-agent": GOOGLEBOT }), "/", true)).toBe(true);
  });

  it("serves people everywhere and crawlers on the English catalog", () => {
    expect(isBlockedCrawl(h({ "user-agent": CHROME }), "/es/event/new-year")).toBe(false);
    expect(isBlockedCrawl(h({ "user-agent": CHROME }), "/search")).toBe(false);
    expect(isBlockedCrawl(h({ "user-agent": CHROME }), "/", true)).toBe(false);
    expect(isBlockedCrawl(h({ "user-agent": GOOGLEBOT }), "/event/new-year")).toBe(false);
    expect(isBlockedCrawl(h({ "user-agent": GOOGLEBOT }), "/")).toBe(false);
    expect(isBlockedCrawl(h({ "user-agent": "Slackbot-LinkExpanding 1.0" }), "/es/event/new-year")).toBe(false);
  });
});

describe("englishDetour", () => {
  it("sends a client without Fetch Metadata from a locale copy to the English page", () => {
    // A browser's user agent on a scripted request: the crawler the user-agent check misses.
    expect(englishDetour(h({ "user-agent": CHROME }), "/es/event/new-year")).toBe("/event/new-year");
    expect(englishDetour(h({ "user-agent": CHROME }), "/zh-hant/days-until/christmas")).toBe("/days-until/christmas");
    expect(englishDetour(h({ "user-agent": CHROME }), "/ES/about")).toBe("/about");
    expect(englishDetour(h({ "user-agent": CHROME }), "/ja")).toBe("/");
  });

  it("leaves browsers, English pages and profiles alone", () => {
    expect(englishDetour(h({ "user-agent": CHROME, "sec-fetch-site": "none" }), "/es/event/new-year")).toBeNull();
    expect(englishDetour(h({ "user-agent": CHROME, "sec-fetch-site": "same-origin", rsc: "1" }), "/es/event/new-year")).toBeNull();
    expect(englishDetour(h({ "user-agent": CHROME }), "/event/new-year")).toBeNull();
    expect(englishDetour(h({ "user-agent": CHROME }), "/esteban")).toBeNull();
    expect(englishDetour(h({ "user-agent": CHROME }), "/search")).toBeNull();
    expect(englishDetour(h({ "user-agent": CHROME }), "/")).toBeNull();
  });
});
