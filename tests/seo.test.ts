import { afterEach, describe, expect, it, vi } from "vitest";
import {
  absoluteUrl,
  buildMetadata,
  collectionHubDescription,
  collectionListDescription,
  eventDescription,
  eventTitle,
  formatLongDate,
  siteUrl,
} from "@/lib/seo";
import robots from "@/app/robots";
import manifest from "@/app/manifest";
import type { CountdownEvent } from "@/lib/types";

const premiere: CountdownEvent = {
  id: "premiere", slug: "a-premiere-2026", title: "A premiere", description: "An upcoming premiere.",
  date: "2026-09-15T00:00:00Z", timezone: "America/New_York", allDay: false,
  category: "tv", tags: [], regions: ["US"], source: "tvmaze", featured: false, popularity: 10,
  datePrecision: "instant", daysUntil: 2,
};

afterEach(() => vi.unstubAllEnvs());

describe("metadata dates and status", () => {
  it("uses the same local event date in titles, descriptions and date labels", () => {
    expect(formatLongDate(premiere.date, premiere.timezone)).toBe("Monday, 14 September 2026");
    expect(eventTitle(premiere)).toContain("Monday, 14 September 2026");
    expect(eventDescription(premiere)).toContain("Monday, 14 September 2026");
    expect(formatLongDate("2026-09-15", premiere.timezone)).toBe("Tuesday, 15 September 2026");
  });

  it("keeps placeholder days out of approximate metadata", () => {
    const approximate = { ...premiere, date: "2027-06-01", datePrecision: "month" as const, daysUntil: undefined };
    expect(eventTitle(approximate)).toContain("expected June 2027");
    expect(eventDescription(approximate)).toContain("exact day is not announced");
    expect(eventDescription(approximate)).not.toContain("1 June");
  });

  it("does not advertise a countdown to a cancelled or postponed event", () => {
    for (const status of ["cancelled", "postponed"] as const) {
      const event = { ...premiere, status, datePrecision: "month" as const };
      expect(eventTitle(event)).toContain(status);
      expect(eventDescription(event)).toContain(status);
      expect(eventDescription(event)).not.toContain("days away");
      expect(eventDescription(event)).not.toContain("Live countdown");
    }
    expect(eventDescription({ ...premiere, status: "tentative" })).toContain("provisionally scheduled");
    expect(eventDescription({ ...premiere, daysUntil: -2 })).toContain("was on");
  });
});

describe("canonical and social metadata", () => {
  it("rejects non-web origins and preserves configured HTTPS origins", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "file:///etc/passwd");
    expect(siteUrl()).toBe("https://until.day");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://until-countdowns-git-fix.vercel.app");
    expect(siteUrl()).toBe("https://until.day");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://until.example/path?preview=1");
    expect(absoluteUrl("/event/example")).toBe("https://until.example/event/example");
  });

  it("provides an absolute canonical and accessible large social cards", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://until.example");
    const metadata = buildMetadata({ title: "An event", description: "The event date.", canonical: "/event/example", ogPath: "/og/default", ogAlt: "An event on Until" });
    expect(metadata.alternates?.canonical).toBe("https://until.example/event/example");
    expect(metadata.openGraph).toMatchObject({ url: "https://until.example/event/example", images: [{ type: "image/png", width: 1200, height: 630, alt: "An event on Until" }] });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", images: [{ alt: "An event on Until" }] });
    expect(metadata.robots).toMatchObject({ index: true, googleBot: { "max-image-preview": "large" } });
  });

  it("gives collection pages count-aware descriptions and unique social cards", () => {
    expect(collectionHubDescription(6, 2)).toContain("6 editorial lists");
    expect(collectionHubDescription(6, 2)).toContain("2 public collections");
    expect(collectionListDescription("Premieres, Halloween, and whatever will make you check the closet.", 4)).toContain(
      "4 countdowns",
    );
    expect(collectionListDescription("Empty list.", 0)).toBe("Empty list.");
    const metadata = buildMetadata({
      title: "The best horror this month · Collections",
      description: collectionListDescription("Premieres and Halloween.", 4),
      canonical: "/collections/featured/scream-this-month",
      ogPath: "/og/featured/scream-this-month",
      ogAlt: "The best horror this month",
    });
    expect(metadata.alternates?.canonical).toContain("/collections/featured/scream-this-month");
    expect(metadata.openGraph).toMatchObject({
      images: [{ type: "image/png", width: 1200, height: 630, alt: "The best horror this month" }],
    });
    expect(
      buildMetadata({
        title: "Empty list · Collections",
        description: "Nothing here.",
        canonical: "/collections/featured/empty",
        ogPath: "/og/featured/empty",
        noindex: true,
      }).robots,
    ).toEqual({ index: false, follow: true });
  });

  it("does not inherit an index directive for private or thin pages", () => {
    const metadata = buildMetadata({ title: "Personal countdown", description: "A shared date.", canonical: "/event/share-example", ogPath: "/og/default", noindex: true });
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(buildMetadata({ title: "Sign in", description: "Sign in to Until.", canonical: "/login", ogPath: "/og/default", noindex: true }).robots).toEqual({ index: false, follow: true });
    // Blocking HTML in robots.txt would keep a crawler from ever seeing the noindex tag…
    const { rules } = robots();
    expect(rules).toMatchObject({ allow: ["/", "/og/", "/ics/", "/api/ics/"] });
    expect(rules).toMatchObject({ disallow: expect.arrayContaining(["/api/"]) });
    expect((rules as { disallow: string[] }).disallow).not.toContain("/event/");
  });

  it("disallows crawling search results and the 26 locale-prefixed copies of the catalog", () => {
    // …except the crawl traps: search results (noindex, uncached, unbounded — walked at ~7 req/s
    // in September 2026) and every non-English locale prefix, whose pages canonicalise to the
    // English URL and multiplied the crawlable catalog by 27. Each prefix gets a `/xx/` line for
    // its pages and a `/xx$` line for its home; the bare `/es` form would also block a `/esteban`
    // profile.
    const disallow = (robots().rules as { disallow: string[] }).disallow;
    expect(disallow).toEqual(expect.arrayContaining(["/search", "/es/", "/es$", "/zh-hant/", "/zh-hant$", "/zh/", "/el/"]));
    expect(disallow.filter((p) => p.endsWith("/"))).toHaveLength(27); // `/api/` + 26 locale prefixes
    expect(disallow).not.toContain("/es");
    expect(disallow).not.toContain("/en/");
    expect(disallow).not.toContain("/*/search");
  });

  it("exposes usable application icons and shortcuts", () => {
    expect(manifest()).toMatchObject({ start_url: "/", theme_color: "#0b0d12", icons: expect.arrayContaining([expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512" })]) });
  });
});
