import { describe, expect, it } from "vitest";
import { eventJsonLd, eventSeries, organization, profilePage, webSite } from "@/lib/jsonld";
import type { CountdownEvent, Series } from "@/lib/types";

const event: CountdownEvent = {
  id: "festival", slug: "festival-2027", title: "A festival", description: "Original event description.",
  summary: "A licensed external summary.", date: "2027-06-14", allDay: true,
  category: "festivals", tags: [], regions: ["GB"], source: "musicbrainz", featured: false, popularity: 20,
  status: "scheduled", datePrecision: "day", jsonldEligible: true,
  location: { name: "A venue", city: "London", country: "GB" },
};

const series: Series = {
  slug: "festival", title: "A festival", category: "festivals", description: "Original series description.",
  summary: "A licensed external summary.", tags: [], regions: ["GB"], popularity: 20, featured: false,
  faq: [], nextDate: event.date, nextAllDay: true, nextPrecision: "day",
};

describe("event structured data", () => {
  it("requires an eligible event, a precise date and a meaningful location", () => {
    expect(eventJsonLd(event)).toMatchObject({ "@type": "Event", startDate: "2027-06-14", description: event.description });
    expect(eventJsonLd({ ...event, jsonldEligible: false })).toBeNull();
    expect(eventJsonLd({ ...event, location: {} })).toBeNull();
    expect(eventJsonLd({ ...event, datePrecision: "month" })).toBeNull();
    expect(eventJsonLd({ ...event, date: "invalid" })).toBeNull();
  });

  it("keeps postponement explicit even when there were earlier date changes", () => {
    const history = [{ date: "2027-05-14" }];
    expect(eventJsonLd({ ...event, status: "postponed", dateHistory: history })).toMatchObject({ eventStatus: "https://schema.org/EventPostponed" });
    expect(eventJsonLd({ ...event, dateHistory: history })).toMatchObject({ eventStatus: "https://schema.org/EventRescheduled", previousStartDate: "2027-05-14" });
    expect(eventJsonLd({ ...event, status: "cancelled", dateHistory: history })).toMatchObject({ eventStatus: "https://schema.org/EventCancelled" });
  });

  it("retains timed instants with offsets and omits invalid end dates", () => {
    const data = eventJsonLd({ ...event, allDay: false, date: "2027-06-14T20:00:00+01:00", endDate: "not-announced" });
    expect(data?.startDate).toBe("2027-06-14T20:00:00+01:00");
    expect(data).not.toHaveProperty("endDate");
  });
});

describe("series and site entities", () => {
  it("uses collections for non-attendable dates and omits approximate schema dates", () => {
    const data = eventSeries({ ...series, nextDate: "2027-01-01", nextPrecision: "year" }, [{ ...event, datePrecision: "year" }]);
    expect(data["@type"]).toBe("CollectionPage");
    expect(data).not.toHaveProperty("startDate");
    expect(data).not.toHaveProperty("subEvent");
    expect(JSON.stringify(data)).not.toContain(series.summary);
  });

  it("uses the same eligibility and status rules for all series children", () => {
    const data = eventSeries(series, [event, { ...event, datePrecision: "month" }]);
    expect(data["@type"]).toBe("EventSeries");
    expect(data.subEvent).toHaveLength(1);
    expect(data.description).toBe(series.description);
    expect(data).not.toHaveProperty("startDate");
  });

  it("links site entities and uses a square branded logo", () => {
    expect(webSite().publisher).toEqual({ "@id": organization()["@id"] });
    expect(organization().logo).toMatchObject({ "@type": "ImageObject", width: 512, height: 512 });
  });

  it("describes a public profile without leaking an account id", () => {
    const data = profilePage("Ada Lovelace", "ada");
    expect(data).toMatchObject({ "@type": "ProfilePage", url: expect.stringMatching(/\/ada$/) });
    expect(data.mainEntity).toMatchObject({ "@type": "Person", name: "Ada Lovelace", alternateName: "@ada" });
    expect(JSON.stringify(data)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});
