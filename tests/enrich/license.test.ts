import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type CommonsImageInfo,
  creditLine,
  evaluateCommonsFile,
  evaluateLl2Candidate,
  evaluateNamedLicense,
  fileHostKind,
  isRehostableFileUrl,
  stripHtml,
  stripTracking,
} from "@/lib/enrich/images/license";

const FIXTURES = join(process.cwd(), "tests", "fixtures", "enrich");

function readInfo(file: string): CommonsImageInfo {
  const data = JSON.parse(readFileSync(join(FIXTURES, file), "utf8")) as {
    query: { pages: Array<{ imageinfo?: CommonsImageInfo[] }> };
  };
  const info = data.query.pages[0].imageinfo?.[0];
  if (!info) throw new Error(`fixture ${file} has no imageinfo`);
  return info;
}

describe("licence names", () => {
  const accepted = [
    "CC0",
    "CC0 1.0",
    "Public domain",
    "PD",
    "PD-USGov",
    "CC BY 2.0",
    "CC BY 4.0",
    "CC BY-SA 4.0",
    "CC BY-SA 3.0 IGO",
    "GODL-India",
    "OGL 3",
    "KOGL Type 1",
    "NASA Image and Media Guidelines",
  ];
  for (const name of accepted) {
    it(`accepts ${name}`, () => {
      expect(evaluateNamedLicense(name)).toEqual({ ok: true });
    });
  }

  const rejected = [
    "Fair use",
    "fair-use",
    "Non-free",
    "CC BY-NC 4.0",
    "CC BY-NC-SA 3.0",
    "CC BY-ND 4.0",
    "All rights reserved",
    "Attribution only, with permission",
  ];
  for (const name of rejected) {
    it(`rejects ${name}`, () => {
      const verdict = evaluateNamedLicense(name);
      expect(verdict.ok).toBe(false);
    });
  }

  it("rejects a missing licence name rather than assuming freedom", () => {
    expect(evaluateNamedLicense(undefined)).toEqual({ ok: false, reason: "no LicenseShortName" });
    expect(evaluateNamedLicense("  ")).toEqual({ ok: false, reason: "no LicenseShortName" });
  });

  it("rejects an unknown licence name", () => {
    const verdict = evaluateNamedLicense("Sierra Nevada Corporation Policy");
    expect(verdict).toMatchObject({ ok: false });
    expect(verdict.ok ? "" : verdict.reason).toContain("not on the allowlist");
  });

  it("rejects free-looking names whose usage terms are not free", () => {
    const verdict = evaluateNamedLicense("CC BY 4.0", "Non-commercial use only");
    expect(verdict.ok).toBe(false);
  });
});

describe("re-hostable file hosts", () => {
  it("accepts a Commons upload path", () => {
    expect(fileHostKind("https://upload.wikimedia.org/wikipedia/commons/6/6b/Ugadi.jpg")).toBe("commons");
    expect(isRehostableFileUrl("https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Ugadi.jpg/1600px-Ugadi.jpg")).toBe(true);
  });

  it("refuses a local (fair-use) en.wikipedia upload", () => {
    expect(fileHostKind("https://upload.wikimedia.org/wikipedia/en/4/46/Grand_Theft_Auto_VI.png")).toBeNull();
  });

  it("refuses arbitrary hosts and non-https urls", () => {
    expect(fileHostKind("https://example.com/photo.jpg")).toBeNull();
    expect(fileHostKind("http://upload.wikimedia.org/wikipedia/commons/6/6b/Ugadi.jpg")).toBeNull();
    expect(fileHostKind("not a url")).toBeNull();
  });

  it("knows the NASA and Launch Library hosts", () => {
    expect(fileHostKind("https://images-assets.nasa.gov/image/PIA12345/PIA12345~orig.jpg")).toBe("nasa");
    expect(fileHostKind("https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/x.jpg")).toBe("launchlibrary");
  });

  it("strips the API's utm tracking parameters", () => {
    expect(stripTracking("https://upload.wikimedia.org/wikipedia/commons/6/6b/U.jpg?utm_source=api&utm_content=original")).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/6/6b/U.jpg",
    );
  });
});

describe("evaluateCommonsFile (recorded API payloads)", () => {
  it("accepts the CC BY-SA Commons photo and keeps its attribution", () => {
    const verdict = evaluateCommonsFile(readInfo("commons-imageinfo-ccbysa.json"), "pageimages");
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.image.license).toBe("CC BY-SA 2.0");
    expect(verdict.image.licenseUrl).toContain("creativecommons.org");
    expect(verdict.image.author).toBe("Kalyan Kanuri");
    expect(verdict.image.attributionRequired).toBe(true);
    expect(verdict.image.originPage).toContain("commons.wikimedia.org/wiki/File:");
    expect(verdict.image.fileUrl).not.toContain("utm_");
    expect(verdict.image.provider).toBe("commons");
  });

  it("takes the 1600px rendition instead of a multi-megabyte original", () => {
    // The `iiurlwidth=1600` thumbnail is already what the hero is built from; downloading the
    // 3148px original (or a 35 MB panorama) to make it is what blew the 12 MB cap.
    const verdict = evaluateCommonsFile(readInfo("commons-imageinfo-ccbysa.json"), "pageimages");
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.image.fileUrl).toContain("/thumb/");
    expect(verdict.image.fileUrl).toContain("1920px-");
  });

  it("keeps the original when it is not wider than the requested thumbnail", () => {
    const verdict = evaluateCommonsFile(
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/1/11/Small.jpg",
        thumburl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Small.jpg/1600px-Small.jpg",
        width: 1200,
        height: 800,
        mime: "image/jpeg",
        extmetadata: { LicenseShortName: { value: "CC BY 4.0" } },
      },
      "test",
    );
    expect(verdict.ok && verdict.image.fileUrl).toBe("https://upload.wikimedia.org/wikipedia/commons/1/11/Small.jpg");
  });

  it("rejects a free file that carries a trademark restriction", () => {
    // brief §21 step 4: `Restrictions=trademarked` is inline-only, and every stored image here
    // becomes a hero or an OG background.
    const verdict = evaluateCommonsFile(
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/1/11/Logo_expo_2027.jpg",
        mime: "image/jpeg",
        extmetadata: {
          LicenseShortName: { value: "Public domain" },
          Restrictions: { value: "trademarked" },
        },
      },
      "wikidata-logo",
    );
    expect(verdict).toMatchObject({ ok: false });
    expect(verdict.ok ? "" : verdict.reason).toContain("restricted: trademarked");
  });

  it("rejects a montage whose required attribution names nobody", () => {
    const verdict = evaluateCommonsFile(
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/1/11/Split.jpg",
        mime: "image/jpeg",
        extmetadata: {
          LicenseShortName: { value: "CC BY-SA 4.0" },
          Artist: { value: "Multiple Authors" },
        },
      },
      "test",
    );
    expect(verdict).toMatchObject({ ok: false });
    expect(verdict.ok ? "" : verdict.reason).toContain("attribution required");
  });

  it("screens portraits of identifiable people only where the caller asks", () => {
    const info = {
      url: "https://upload.wikimedia.org/wikipedia/commons/1/11/President.jpg",
      mime: "image/jpeg",
      extmetadata: {
        LicenseShortName: { value: "CC BY 4.0" },
        Artist: { value: "A Photographer" },
        Categories: { value: "Portrait photographs of politicians|2024 in the Maldives" },
      },
    };
    expect(evaluateCommonsFile(info, "wikidata-p18").ok).toBe(true);
    const guarded = evaluateCommonsFile(info, "wikidata-p18", { rejectPortraits: true });
    expect(guarded).toMatchObject({ ok: false });
    expect(guarded.ok ? "" : guarded.reason).toContain("identifiable person");
  });

  it("rejects the real fair-use en.wikipedia file the Action API happily returns", () => {
    const verdict = evaluateCommonsFile(readInfo("enwiki-imageinfo-fairuse.json"), "pageimages");
    expect(verdict.ok).toBe(false);
    // The URL check fires first: the file is under /wikipedia/en/, not /wikipedia/commons/.
    expect(verdict.ok ? "" : verdict.reason).toContain("not a Commons file url");
  });

  it("rejects a Commons-hosted file flagged NonFree", () => {
    const verdict = evaluateCommonsFile(
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/1/11/X.jpg",
        extmetadata: { NonFree: { value: "true" }, LicenseShortName: { value: "CC BY 4.0" } },
      },
      "test",
    );
    expect(verdict).toEqual({ ok: false, reason: "NonFree=true" });
  });

  it("rejects an NC licence on Commons", () => {
    const verdict = evaluateCommonsFile(
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/1/11/X.jpg",
        extmetadata: { LicenseShortName: { value: "CC BY-NC 2.0" } },
      },
      "test",
    );
    expect(verdict.ok).toBe(false);
  });

  it("rejects a file with no licence metadata at all", () => {
    const verdict = evaluateCommonsFile({ url: "https://upload.wikimedia.org/wikipedia/commons/1/11/X.jpg" }, "test");
    expect(verdict).toEqual({ ok: false, reason: "no LicenseShortName" });
  });

  it("rejects a non-raster mime type", () => {
    const verdict = evaluateCommonsFile(
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/1/11/X.svg",
        mime: "image/svg+xml",
        extmetadata: { LicenseShortName: { value: "CC0" } },
      },
      "test",
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.ok ? "" : verdict.reason).toContain("unsupported mime");
  });

  it("treats a public-domain file as not requiring attribution", () => {
    const verdict = evaluateCommonsFile(
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/1/11/X.jpg",
        mime: "image/jpeg",
        extmetadata: { LicenseShortName: { value: "Public domain" } },
      },
      "test",
    );
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.image.attributionRequired).toBe(false);
  });
});

describe("Launch Library candidates", () => {
  it("accepts an allowlisted licence on the LL2 CDN", () => {
    const verdict = evaluateLl2Candidate(
      "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/space_launch.jpg",
      { license: "NASA Image and Media Guidelines", author: "NASA/Joel Kowsky", pageUrl: "https://ll.thespacedevs.com/x" },
      "candidate-ll2",
    );
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.image.author).toBe("NASA/Joel Kowsky");
      expect(verdict.image.provider).toBe("launchlibrary");
    }
  });

  it('rejects the "Unknown" licence that 42% of LL2 images carry', () => {
    const verdict = evaluateLl2Candidate(
      "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/x.jpg",
      { license: "Unknown" },
      "candidate-ll2",
    );
    expect(verdict.ok).toBe(false);
  });

  it("rejects the non-commercial ESA standard licence", () => {
    const verdict = evaluateLl2Candidate(
      "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/x.jpg",
      { license: "ESA Standard Licence" },
      "candidate-ll2",
    );
    expect(verdict.ok).toBe(false);
  });
});

describe("credit rendering", () => {
  it("renders author, licence and provider", () => {
    expect(creditLine({ author: "Kalyan Kanuri", license: "CC BY-SA 2.0", provider: "commons" })).toBe(
      "Photo: Kalyan Kanuri · CC BY-SA 2.0 · via Wikimedia Commons",
    );
  });

  it("drops the author when the file has none", () => {
    expect(creditLine({ author: null, license: "Public domain", provider: "commons" })).toBe(
      "Public domain · via Wikimedia Commons",
    );
  });

  it("names the NASA and Launch Library providers", () => {
    expect(creditLine({ author: "NASA/JPL", license: "NASA Image and Media Guidelines", provider: "nasa" })).toContain("via NASA");
    expect(creditLine({ author: null, license: "CC BY 4.0", provider: "launchlibrary" })).toContain("via Launch Library 2");
  });

  it("turns the API's HTML author fragment into plain text", () => {
    expect(stripHtml('<a rel="nofollow" href="https://flickr.com/x">Kalyan &amp; Co</a>')).toBe("Kalyan & Co");
    expect(stripHtml(null)).toBeNull();
    expect(stripHtml("   ")).toBeNull();
  });

  it("drops the hidden microformat duplicate Commons appends to Artist", () => {
    expect(stripHtml('Ansel Adams<span style="display: none;">Ansel Adams</span>')).toBe("Ansel Adams");
  });

  it('treats "Unknown author" as no author at all', () => {
    expect(stripHtml('Unknown author<span style="display: none;">Unknown author</span>')).toBeNull();
    expect(stripHtml("Anonymous")).toBeNull();
    expect(creditLine({ author: stripHtml("Unknown author"), license: "Public domain", provider: "commons" })).toBe(
      "Public domain · via Wikimedia Commons",
    );
  });
});
