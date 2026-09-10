import { describe, expect, it } from "vitest";
import { backoffUntil, isEnrichKind, MAX_ERROR_CHARS, truncateError } from "@/lib/enrich/jobs";
import { evaluateCommonsFile } from "@/lib/enrich/images/license";
import { fileTitle, fileTitleFromUrl } from "@/lib/enrich/images/commons";
import { fileCandidates, parseEntities } from "@/lib/enrich/images/wikidata";
import { acceptableItems, pickAsset } from "@/lib/enrich/images/nasa";
import { resolveAdapterCandidate, type ResolvableEvent } from "@/lib/enrich/images/resolve";
import type { CommonsVerifier } from "@/lib/enrich/images/commons";

const NOW = Date.parse("2026-09-09T00:00:00Z");
const HOUR = 3_600_000;

describe("job backoff", () => {
  it("doubles the wait with every attempt", () => {
    expect(backoffUntil(1, NOW)).toBe(new Date(NOW + 2 * HOUR).toISOString());
    expect(backoffUntil(3, NOW)).toBe(new Date(NOW + 8 * HOUR).toISOString());
  });

  it("caps the wait at seven days", () => {
    expect(backoffUntil(20, NOW)).toBe(new Date(NOW + 7 * 24 * HOUR).toISOString());
  });

  it("truncates a long upstream error to fit the column", () => {
    const long = truncateError("x".repeat(2000));
    expect(long.length).toBe(MAX_ERROR_CHARS);
    expect(truncateError("  a\n  b  ")).toBe("a b");
  });

  it("only accepts the two known job kinds", () => {
    expect(isEnrichKind("image")).toBe(true);
    expect(isEnrichKind("wikipedia_summary")).toBe(true);
    expect(isEnrichKind("thumbnail")).toBe(false);
  });
});

describe("commons file titles", () => {
  it("normalises a bare file name", () => {
    expect(fileTitle("A_Happy_Ugadi.jpg")).toBe("File:A Happy Ugadi.jpg");
    expect(fileTitle("File:Already Prefixed.jpg")).toBe("File:Already Prefixed.jpg");
  });

  it("recovers the file title from every url shape an adapter stores", () => {
    expect(fileTitleFromUrl("https://commons.wikimedia.org/wiki/Special:FilePath/Sharpeville.jpg")).toBe("File:Sharpeville.jpg");
    expect(fileTitleFromUrl("https://commons.wikimedia.org/wiki/File:Sharpeville.jpg")).toBe("File:Sharpeville.jpg");
    expect(fileTitleFromUrl("https://upload.wikimedia.org/wikipedia/commons/6/6b/Ugadi_tray.jpg")).toBe("File:Ugadi tray.jpg");
    expect(fileTitleFromUrl("https://example.com/photo.jpg")).toBeNull();
  });
});

describe("wikidata claim order", () => {
  const entities = parseEntities({
    entities: {
      Q1: {
        claims: {
          P18: [{ mainsnak: { snaktype: "value", datavalue: { value: "Event photo.jpg" } } }],
          P154: [{ mainsnak: { snaktype: "value", datavalue: { value: "Event logo.png" } } }],
          P276: [{ mainsnak: { snaktype: "value", datavalue: { value: { id: "Q9" } } } }],
          P17: [{ mainsnak: { snaktype: "value", datavalue: { value: { id: "Q8" } } } }],
        },
      },
      Q2: { claims: { P18: [{ mainsnak: { snaktype: "value", datavalue: { value: "Scan.pdf" } } }] } },
    },
  });
  const secondary = parseEntities({
    entities: {
      Q9: { claims: { P18: [{ mainsnak: { snaktype: "value", datavalue: { value: "Venue.jpg" } } }] } },
      Q8: { claims: { P41: [{ mainsnak: { snaktype: "value", datavalue: { value: "Flag.png" } } }] } },
    },
  });

  it("prefers P18, then the venue, and only adds the flag where it makes sense", () => {
    const files = fileCandidates(entities.get("Q1"), secondary, { allowFlag: true });
    expect(files.map((f) => f.file)).toEqual(["Event photo.jpg", "Venue.jpg", "Flag.png"]);
  });

  it("never offers the P154 logo unless a caller explicitly asks for one", () => {
    // Trademarked marks are inline-only per brief §21 and Until has no inline surface, so the
    // default (what every caller uses) must not produce a logo candidate.
    const byDefault = fileCandidates(entities.get("Q1"), secondary, {});
    expect(byDefault.some((f) => f.via === "wikidata-logo")).toBe(false);
    const optedIn = fileCandidates(entities.get("Q1"), secondary, { allowLogo: true });
    expect(optedIn.map((f) => f.via)).toEqual(["wikidata-p18", "wikidata-logo", "wikidata-venue"]);
  });

  it("drops a non-raster P18 value", () => {
    expect(fileCandidates(entities.get("Q2"), secondary, {})).toEqual([]);
  });
});

describe("nasa screening", () => {
  it("drops third-party and logo assets, keeps a plain NASA photo", () => {
    const items = acceptableItems({
      collection: {
        items: [
          { href: "https://images-api.nasa.gov/asset/a", data: [{ nasa_id: "a", media_type: "image", title: "Total solar eclipse", center: "GSFC" }] },
          { href: "https://images-api.nasa.gov/asset/b", data: [{ nasa_id: "b", media_type: "image", title: "Artemis logo" }] },
          { href: "https://images-api.nasa.gov/asset/c", data: [{ nasa_id: "c", media_type: "image", title: "Nebula", description: "Copyright: Gregg Hallinan" }] },
          { href: "https://images-api.nasa.gov/asset/d", data: [{ nasa_id: "d", media_type: "video", title: "Launch" }] },
        ],
      },
    });
    expect(items.map((i) => i.nasaId)).toEqual(["a"]);
    expect(items[0].credit).toBe("NASA/GSFC");
  });

  it("takes the largest rendition from an asset manifest", () => {
    expect(
      pickAsset({
        collection: {
          items: [
            { href: "https://images-assets.nasa.gov/image/a/a~medium.jpg" },
            { href: "https://images-assets.nasa.gov/image/a/a~orig.jpg" },
            { href: "https://images-assets.nasa.gov/image/a/a~thumb.jpg" },
          ],
        },
      }),
    ).toBe("https://images-assets.nasa.gov/image/a/a~orig.jpg");
  });
});

describe("adapter candidates (chain step a)", () => {
  function event(patch: Partial<ResolvableEvent>): ResolvableEvent {
    return {
      id: "e",
      slug: "s",
      title: "T",
      category: "space",
      tags: [],
      external_ids: {},
      source_url: null,
      image_candidate_url: null,
      image_candidate_meta: null,
      ...patch,
    };
  }
  /** The chain only ever calls `verify` on a Commons candidate. */
  const verifier = {
    verify: async (name: string, via: string) =>
      evaluateCommonsFile(
        {
          url: `https://upload.wikimedia.org/wikipedia/commons/1/11/${name.replace(/^File:/, "").replace(/ /g, "_")}`,
          mime: "image/jpeg",
          extmetadata: { LicenseShortName: { value: "CC BY-SA 4.0" }, Artist: { value: "<a href='#'>Someone</a>" } },
        },
        via,
      ),
  } as unknown as CommonsVerifier;

  it("returns null when the adapter left no candidate", async () => {
    expect(await resolveAdapterCandidate(event({}), verifier)).toBeNull();
  });

  it("verifies a Commons candidate against Commons before accepting it", async () => {
    const result = await resolveAdapterCandidate(
      event({
        image_candidate_url: "https://commons.wikimedia.org/wiki/Special:FilePath/Sharpeville.jpg",
        image_candidate_meta: { provider: "commons", pageUrl: "https://commons.wikimedia.org/wiki/File:Sharpeville.jpg" },
      }),
      verifier,
    );
    expect(result?.ok).toBe(true);
    if (result?.ok) expect(result.image.via).toBe("candidate-commons");
  });

  it("accepts an allowlisted Launch Library image with no network call", async () => {
    const result = await resolveAdapterCandidate(
      event({
        image_candidate_url: "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/x.jpg",
        image_candidate_meta: { provider: "launchlibrary", license: "CC BY 4.0", author: "SpaceX" },
      }),
      verifier,
    );
    expect(result?.ok).toBe(true);
  });

  it("holds a NASA candidate to the same host and licence gate as every other branch", async () => {
    const nasaEvent = (meta: Record<string, unknown>, url = "https://images-assets.nasa.gov/image/a/a~orig.jpg") =>
      event({ image_candidate_url: url, image_candidate_meta: { provider: "nasa", ...meta } });

    const paywalled = await resolveAdapterCandidate(
      nasaEvent({ license: "NASA Image and Media Guidelines" }, "https://cdn.getty.example.com/paywalled.jpg"),
      verifier,
    );
    expect(paywalled?.ok).toBe(false);
    expect(paywalled && !paywalled.ok ? paywalled.reason : "").toContain("not a NASA asset url");

    for (const license of ["All rights reserved", "CC BY-NC 4.0", "Copyright Rick Sternbach", ""]) {
      const verdict = await resolveAdapterCandidate(nasaEvent({ license }), verifier);
      expect(verdict?.ok, license || "(empty licence)").toBe(false);
    }

    const good = await resolveAdapterCandidate(nasaEvent({ license: "NASA Image and Media Guidelines" }), verifier);
    expect(good?.ok).toBe(true);
    if (good?.ok) expect(good.image.provider).toBe("nasa");
  });

  it("refuses a provider whose terms do not cover re-hosting", async () => {
    const result = await resolveAdapterCandidate(
      event({ image_candidate_url: "https://cdn.example.com/x.jpg", image_candidate_meta: { provider: "tvmaze" } }),
      verifier,
    );
    expect(result?.ok).toBe(false);
    expect(result && !result.ok ? result.reason : "").toContain("not re-hostable");
  });
});
