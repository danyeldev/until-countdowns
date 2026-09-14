import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CountdownEvent, Series } from "@/lib/types";

const catalog = vi.hoisted(() => ({
  getEvent: vi.fn(),
  getSeries: vi.fn(),
  resolveSlugAlias: vi.fn(),
  resolveSeriesAlias: vi.fn(),
}));
vi.mock("@/lib/catalog", () => catalog);

import { GET as oembed } from "@/app/api/oembed/route";
import { resolveEmbedSubject } from "@/lib/embed/resolve";
import { absoluteUrl } from "@/lib/seo";

const event: CountdownEvent = {
  id: "festival-2027-06-14",
  slug: "festival-2027-06-14",
  title: "Summer festival",
  description: "The annual summer festival.",
  date: "2027-06-14",
  allDay: true,
  category: "festivals",
  tags: [],
  regions: [],
  source: "curated",
  featured: false,
  popularity: 20,
  status: "scheduled",
  datePrecision: "day",
};

const series: Series = {
  slug: "summer-festival",
  title: event.title,
  description: event.description,
  category: event.category,
  tags: [],
  regions: [],
  popularity: 20,
  featured: false,
  faq: [],
  nextSlug: event.slug,
  nextDate: event.date,
  nextAllDay: true,
  nextPrecision: "day",
  nextStatus: "scheduled",
};

beforeEach(() => {
  vi.resetAllMocks();
  catalog.getEvent.mockResolvedValue(null);
  catalog.getSeries.mockResolvedValue(null);
  catalog.resolveSlugAlias.mockResolvedValue(null);
  catalog.resolveSeriesAlias.mockResolvedValue(null);
});

describe("embed subject availability", () => {
  it("keeps the timezone for event and series date labels", async () => {
    catalog.getEvent.mockResolvedValue({
      ...event,
      allDay: false,
      timezone: "America/New_York",
    });
    expect(await resolveEmbedSubject(event.slug)).toMatchObject({
      timezone: "America/New_York",
    });
    catalog.getEvent.mockResolvedValue(null);
    catalog.getSeries.mockResolvedValue({
      ...series,
      nextAllDay: false,
      nextTimezone: "America/New_York",
    });
    expect(await resolveEmbedSubject(series.slug)).toMatchObject({
      timezone: "America/New_York",
    });
  });

  it("resolves a scheduled event with its exact date and canonical link", async () => {
    catalog.getEvent.mockResolvedValue(event);
    expect(await resolveEmbedSubject(event.slug)).toMatchObject({
      slug: event.slug,
      date: event.date,
      href: absoluteUrl(`/event/${event.slug}`),
    });
  });

  it("refuses a postponed event even when its previous date is precise", async () => {
    catalog.getEvent.mockResolvedValue({ ...event, status: "postponed" });
    expect(await resolveEmbedSubject(event.slug)).toBeNull();
  });

  it("resolves a series whose next occurrence remains scheduled", async () => {
    catalog.getSeries.mockResolvedValue(series);
    expect(await resolveEmbedSubject(series.slug)).toMatchObject({
      slug: series.slug,
      date: series.nextDate,
      href: absoluteUrl(`/days-until/${series.slug}`),
    });
  });

  it("refuses a series whose next occurrence is postponed", async () => {
    catalog.getSeries.mockResolvedValue({ ...series, nextStatus: "postponed" });
    expect(await resolveEmbedSubject(series.slug)).toBeNull();
  });

  it.each(["event", "series"] as const)(
    "oEmbed does not publish a widget for a postponed %s",
    async (kind) => {
      if (kind === "event")
        catalog.getEvent.mockResolvedValue({ ...event, status: "postponed" });
      else
        catalog.getSeries.mockResolvedValue({
          ...series,
          nextStatus: "postponed",
        });
      const path =
        kind === "event"
          ? `/event/${event.slug}`
          : `/days-until/${series.slug}`;
      const url = new URL(absoluteUrl("/api/oembed"));
      url.searchParams.set("url", absoluteUrl(path));
      const response = await oembed(new NextRequest(url));
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not found");
    },
  );
});
