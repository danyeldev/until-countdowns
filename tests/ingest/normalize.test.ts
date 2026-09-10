import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  TAGS_MAX,
  TAG_MAX,
  buildEvent,
  classify,
  contentHash,
  decodeEntities,
  isFarFuture,
  periodEnd,
  precisionFromWikidata,
  rejectReserved,
  sanitizeTitle,
  slugify,
  stableStringify,
} from "@/lib/ingest/normalize";
import { IngestEventSchema } from "@/lib/ingest/types";

const NOW = new Date("2026-09-09T12:00:00Z");

describe("slugify", () => {
  it("matches the seed scheme (lowercase, ascii, dashes, 80 chars)", () => {
    expect(slugify("New Year's Day")).toBe("new-year-s-day");
    expect(slugify("Día de los Muertos")).toBe("dia-de-los-muertos");
    expect(slugify("  Süßes -- Ünïcode! ")).toBe("su-es-unicode"); // ß has no NFKD decomposition, same as the seed
    expect(slugify("x".repeat(100))).toHaveLength(80);
  });
});

describe("classify", () => {
  it("applies TAG_RULES in order and falls back", () => {
    expect(classify("Christmas Day")).toEqual({ category: "holidays", tags: ["christmas", "religious"] });
    expect(classify("Independence Day", "holidays").tags).toContain("national");
    expect(classify("Perseid meteor shower peak").category).toBe("astronomy");
    expect(classify("Something else", "culture")).toEqual({ category: "culture", tags: [] });
  });
});

describe("sanitizeTitle", () => {
  it("strips tags, reference markers and entities, collapses whitespace", () => {
    expect(sanitizeTitle('Super Bowl<sup class="reference">[1]</sup> &amp;   LXI[citation needed]')).toBe("Super Bowl & LXI");
    expect(sanitizeTitle("A <b>bold</b>\n\ttitle &ndash; here<ref>x</ref>")).toBe("A bold title – here");
    expect(decodeEntities("&#8211; &#x2014; &quot;")).toBe("– — \"");
  });
  it("caps at 200 characters on a word boundary", () => {
    const t = sanitizeTitle(`${"word ".repeat(60)}end`);
    expect(t.length).toBeLessThanOrEqual(200);
    expect(t.endsWith("word")).toBe(true);
  });
});

describe("contentHash", () => {
  const base = {
    title: "T",
    description: "d",
    date: "2027-01-01",
    end_date: null,
    all_day: true,
    category: "culture" as const,
    tags: ["b", "a"],
    regions: ["US", "GLOBAL"],
    source: "curated" as const,
    source_url: null,
    featured: false,
    popularity: 50,
    status: "scheduled" as const,
    date_precision: "day" as const,
    confidence: 1,
    external_ids: { qid: "Q1", enwiki: "X" },
  };
  it("is stable across tag/region/external_ids ordering", () => {
    const a = contentHash(base);
    const b = contentHash({ ...base, tags: ["a", "b"], regions: ["GLOBAL", "US"], external_ids: { enwiki: "X", qid: "Q1" } });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("changes with content and with a series link, but not with null series", () => {
    expect(contentHash({ ...base, popularity: 51 })).not.toBe(contentHash(base));
    expect(contentHash({ ...base, series_slug: null })).toBe(contentHash(base));
    expect(contentHash({ ...base, series_slug: "t" })).not.toBe(contentHash(base));
  });
  it("matches the push-catalog hash for a known row", () => {
    // Same JSON shape as scripts/push-catalog.mjs contentHash: sha256(JSON.stringify({...}))
    const expected = createHash("sha256")
      .update(
        JSON.stringify({
          title: "T", description: "d", date: "2027-01-01", end_date: null, all_day: true, category: "culture",
          tags: ["a", "b"], regions: ["GLOBAL", "US"], source: "curated", source_url: null, featured: false,
          popularity: 50, status: "scheduled", date_precision: "day", confidence: 1, external_ids: { enwiki: "X", qid: "Q1" },
        }),
      )
      .digest("hex");
    expect(contentHash(base)).toBe(expected);
  });
});

describe("stableStringify", () => {
  it("sorts keys recursively and drops undefined", () => {
    expect(stableStringify({ b: 1, a: { d: undefined, c: [3, { z: 1, y: 2 }] } })).toBe('{"a":{"c":[3,{"y":2,"z":1}]},"b":1}');
  });
});

describe("far-future guard", () => {
  it("drops rows more than 15 years out unless tagged far-future", () => {
    expect(isFarFuture("2045-08-12", [], NOW)).toBe(true);
    expect(isFarFuture("2045-08-12", ["far-future"], NOW)).toBe(false);
    expect(isFarFuture("2041-01-01", [], NOW)).toBe(false);
  });
});

describe("precision helpers", () => {
  it("maps Wikidata precisions and computes period ends", () => {
    expect(precisionFromWikidata(11)).toBe("day");
    expect(precisionFromWikidata(9)).toBe("year");
    expect(precisionFromWikidata(7)).toBeNull();
    expect(periodEnd("2027-01-01", "year")).toBe("2027-12-31");
    expect(periodEnd("2027-02-01", "month")).toBe("2027-02-28");
    expect(periodEnd("2027-04-01", "quarter")).toBe("2027-06-30");
  });
});

describe("buildEvent", () => {
  it("builds a valid row with slug slugify(title)-YYYY-MM-DD and default source_key", () => {
    const ev = buildEvent({
      title: "  Boston Marathon  ",
      date: "2027-04-19",
      category: "sports",
      tags: ["Running", "marathon"],
      regions: ["US"],
      description: "x",
      source: "curated",
      popularity: 66,
    });
    expect(ev.slug).toBe("boston-marathon-2027-04-19");
    expect(ev.source_key).toBe("curated:boston-marathon-2027-04-19");
    expect(ev.tags).toEqual(["running", "marathon"]);
    expect(ev.confidence).toBe(1);
    expect(ev.status).toBe("scheduled");
    expect(IngestEventSchema.safeParse(ev).success).toBe(true);
  });
  it("marks coarse precision tentative, keeps instants, drops inverted end dates", () => {
    const y = buildEvent({ title: "Artemis III", date: "2027-01-01", category: "space", source: "curated", datePrecision: "year" });
    expect(y.status).toBe("tentative");
    const i = buildEvent({ title: "Y2K38", date: "2038-01-19T03:14:07Z", category: "tech", source: "curated", allDay: false });
    expect(i.date_precision).toBe("instant");
    expect(i.all_day).toBe(false);
    expect(i.slug).toBe("y2k38-2038-01-19");
    const e = buildEvent({ title: "Bad range", date: "2027-05-02", endDate: "2027-05-01", category: "culture", source: "curated" });
    expect(e.end_date).toBeNull();
  });
  it("rejects reserved slugs through the schema", () => {
    expect(rejectReserved("mine-foo")).toBe(true);
    const ev = buildEvent({ title: "Mine thing", date: "2027-01-01", category: "culture", source: "curated" });
    expect(IngestEventSchema.safeParse({ ...ev, slug: "mine-thing-2027-01-01" }).success).toBe(false);
    expect(IngestEventSchema.safeParse({ ...ev, slug: "share-thing-2027-01-01" }).success).toBe(false);
  });
});

describe("slug fallback for titles without Latin letters", () => {
  it("buildEvent never produces an empty slug base; the fallback is deterministic and title-specific", () => {
    const a = buildEvent({ title: "عيد الإستقلال", date: "2028-03-20", category: "holidays", source: "holidays", slugFallbackPrefix: "holiday-TN" });
    const b = buildEvent({ title: "عيد الشهداء", date: "2028-03-20", category: "holidays", source: "holidays", slugFallbackPrefix: "holiday-TN" });
    const again = buildEvent({ title: "عيد الإستقلال", date: "2028-03-20", category: "holidays", source: "holidays", slugFallbackPrefix: "holiday-TN" });
    expect(a.slug).toMatch(/^holiday-tn-[0-9a-f]{8}-2028-03-20$/);
    expect(a.slug).toBe(again.slug);
    expect(a.slug).not.toBe(b.slug);
    expect(a.source_key).toBe(`holidays:${a.slug}`);
    expect(IngestEventSchema.safeParse(a).success).toBe(true);
    const thai = buildEvent({ title: "วันสงกรานต์", date: "2027-04-13", category: "holidays", source: "holidays" });
    expect(thai.slug).toMatch(/^holidays-[0-9a-f]{8}-2027-04-13$/);
  });
  it("the schema rejects slugs with an empty base", () => {
    const row = buildEvent({ title: "Independence Day", date: "2028-03-20", category: "holidays", source: "holidays" });
    expect(IngestEventSchema.safeParse({ ...row, slug: "-2028-03-20" }).success).toBe(false);
    expect(IngestEventSchema.safeParse({ ...row, slug: "--2028-03-20" }).success).toBe(false);
    expect(IngestEventSchema.safeParse(row).success).toBe(true);
  });
});

describe("sports classification", () => {
  it("wins over the family rule and recognises games/cups/leagues", () => {
    for (const title of [
      "2026 Summer Youth Olympics",
      "2026 Asian Games",
      "2027 AFC Asian Cup final",
      "2027 UEFA Champions League final",
      "2027 UEFA Europa League final",
      "2027 Australian Open",
      "Stanley Cup Finals",
    ]) {
      expect(classify(title, "culture").category, title).toBe("sports");
    }
    expect(classify("Universal Children's Day", "culture").tags).toEqual(["family"]);
    expect(classify("Final Fantasy XVII", "games").category).toBe("games");
    expect(classify("Justice League Unlimited", "film").category).toBe("film");
    expect(classify("Video Games Day", "culture").category).toBe("culture");
  });
});

describe("classify: a surname is not a feast day", () => {
  it("does not read Whitlock, Whittaker or White as Whitsun", () => {
    // `whit` used to be an unanchored alternative in the Christian-feast rule, so a UFC card came
    // back tagged religious and categorised as a holiday. Robert Whittaker is a real fighter.
    for (const title of ["UFC 349: Ferreira vs. Whitlock", "UFC 320: Whittaker vs. Costa", "Dana White's Contender Series"]) {
      expect(classify(title, "sports")).toEqual({ category: "sports", tags: [] });
    }
    expect(classify("Amazon Kindle Paperwhite (11th Generation) end of life", "tech").tags).toEqual([]);
  });

  it("still reads the feast it was written for", () => {
    for (const title of ["Whit Sunday", "Whit Monday", "Whitsun", "Whitsuntide"]) {
      expect(classify(title, "sports")).toEqual({ category: "holidays", tags: ["religious", "christian"] });
    }
  });
});

describe("classify: an artist, an album or a venue is not a holiday", () => {
  // Same bug class as the Whittaker case above, found by running the shipped rules over a corpus
  // of real music names: `ces` made "Pieces of a Man" a tech conference, `easter` made "Eastern
  // Market" a Christian feast, `olympi` made every Olympia-named venue a sporting event, `labou?r`
  // made "Collaboration" Labour Day. Nothing here carries a music-only escape hatch — the rules
  // were wrong for every caller — so each of these must come back with no opinion at all.
  // A few entries never misfired (Kings of Leon slipped past `\bking\b` on its plural, "Easton"
  // is one letter off "easter"): they are the near-misses, here so that a later widening of a
  // token has to trip over them.
  const noOpinion = (title: string) => expect(classify(title, "music"), title).toEqual({ category: "music", tags: [] });

  it("leaves artists and bands alone", () => {
    for (const title of [
      "Frank Ocean", "Oceans Ate Alaska", "Sonic Youth", "Youth Lagoon", "Children of Bodom",
      "Sly and the Family Stone", "Prophets of Rage", "Natalie Merchant", "Natalia Lafourcade",
      "Noelle Scaggs", "Sheena Easton", "Pasquale Grasso", "Jorge Pascual", "Queen",
      "Queen + Adam Lambert", "Kings of Leon", "King Gizzard & the Lizard Wizard", "Royal Blood",
      "Emperor", "Sultan + Shepard", "My Bloody Valentine", "All Saints", "Whitney Houston",
    ]) noOpinion(title);
  });

  it("leaves album and song titles alone", () => {
    for (const title of [
      "Pieces of a Man", "Voices", "Places Like This", "Forces of Victory", "Traces of You",
      "Aces High", "Devices and Desires", "The Immaculate Collection", "Meteora", "Liberation",
      "Ocean Avenue", "Blue Ocean Floor", "Ocean Eyes", "Natural Selection", "Best Selection 2000",
      "The Marathon Continues", "Heroes", "Guitar Heroes", "Elaborate Lives", "Laboratory",
      "Collaboration", "Youth Novels", "Children of the Sun", "Family Affair", "Youth of the Nation",
      "Buddha", "Memorial", "Heroes and Villains",
      // The remembrance rule reaches for "Armed Forces Day"; the bare album title is why that
      // branch has to keep looking for the occasion word.
      "Armed Forces",
    ]) noOpinion(title);
  });

  it("leaves tour names alone", () => {
    for (const title of [
      "Epiphany Tour", "The Ascension Tour", "Liberation Tour", "Ocean Tour", "Heroes Tour",
      "Marathon Tour", "Voices Tour", "Sonic Youth Reunion Tour", "Prophets of Rage Tour",
      "The Eras Tour", "Music of the Spheres World Tour", "Renaissance World Tour",
    ]) noOpinion(title);
  });

  it("leaves venue names alone", () => {
    for (const title of [
      "Olympiastadion Berlin", "Olympiahalle Munich", "Olympia Theatre Dublin", "L'Olympia Paris",
      "Grand Olympic Auditorium", "Marathon Music Works", "Royal Albert Hall", "Royal Festival Hall",
      "Queen Elizabeth Theatre", "King's Theatre Glasgow", "DAR Constitution Hall", "Memorial Stadium",
      "Veterans Memorial Coliseum", "War Memorial Auditorium", "Eastern Market",
      "Bozeman Brick Breeden Fieldhouse", "Mount Olympus Amphitheatre",
    ]) noOpinion(title);
  });

  it("does not read a sporting or civic name as a feast, a conference or an election", () => {
    // Seven of the names the holidays adapter emits for 2026-2028 were tech conferences, six of
    // them a spelling of "Armed Forces Day"; "Frances Xavier Cabrini Day" is the same accident in
    // the wider data file. "Eastern Conference Finals" was a Christian feast, and it stays sport
    // rather than falling through to the tech rule's `conference` now that `easter` is anchored.
    // The Armed Forces names are asserted positively in the holiday table above: they are
    // remembrance holidays, and stopping them being conferences is not the same as wanting them
    // to match nothing.
    expect(classify("Eastern Conference Finals", "sports").category).toBe("sports");
    expect(classify("Eastern Conference Semifinals", "sports").category).toBe("sports");
    expect(classify("Frances Xavier Cabrini Day", "holidays")).toEqual({ category: "holidays", tags: [] });
    expect(classify("Natalicio de Benito Juárez", "holidays")).toEqual({ category: "holidays", tags: [] });
    expect(classify("Selection Sunday", "sports")).toEqual({ category: "sports", tags: [] });
    expect(classify("Royal Rumble", "sports")).toEqual({ category: "sports", tags: [] });
  });

  // Known residual, and not fixable on a title alone: a work named exactly after the feast or the
  // observance still classifies as one — "Ascension", "Epiphany", "Passover", "Eclipse", "Equinox",
  // "New Year's Day", Noel Gallagher (his given name is the French for Christmas) and the city of
  // Corpus Christi. They need a signal beyond the string.
});

describe("classify: the holidays the rules were written for still classify", () => {
  // Provenance, because it is the whole value of the block: 52 of the 61 are verbatim names from
  // date-holidays — mostly what the `holidays` adapter itself emits (it asks for
  // `languages: ["en"]`, `types: ["public"]`), the rest from other locales in data/holidays.json
  // that other adapters can still hand us. Both apostrophes occur in that data, so both are
  // covered. Of the nine that are not, seven are catalogue titles lifted from src/data (Earth Day,
  // World Oceans/Environment Day, Boston Marathon 2026, Milano Cortina 2026 Winter Olympics,
  // CES 2027, Perseid meteor shower peak); "Día de San Valentín" and "Paralympic Games" are shapes
  // rather than sightings — they pin two alternatives the anchoring added, and nothing reachable
  // from here confirms a source spells them that way.
  //
  // The last five are the shapes that punish a careless \b: the holiday data spells Polish
  // Christmas only in the genitive ("Bożego", never "Boże") and Italian Christmas only as
  // "Natale", and date-holidays appends "(substitute day)" at runtime, so a `$`-anchored title
  // rule has to allow it. Each of these was live and lost to an earlier draft of the anchoring.
  const cases: Array<[string, string, string[]]> = [
    ["Easter Monday", "holidays", ["easter", "religious"]],
    ["Catholic Easter", "holidays", ["easter", "religious"]],
    ["Noël", "holidays", ["christmas", "religious"]],
    ["Ascension Day", "holidays", ["religious", "christian"]],
    ["Jour de l'Ascension", "holidays", ["religious", "christian"]],
    ["Giorno dell'Ascensione", "holidays", ["religious", "christian"]],
    ["Epiphany", "holidays", ["religious", "christian"]],
    ["Orthodox Epiphany", "holidays", ["religious", "christian"]],
    ["All Saints' Day", "holidays", ["religious", "christian"]],
    ["All Souls' Day", "holidays", ["religious", "christian"]],
    ["Immaculate Conception of Mary", "holidays", ["religious", "christian"]],
    ["Milad-Un-Nabi (Holy Prophet's Birthday)", "holidays", ["religious", "islamic"]],
    ["Birthday of Muhammad Prophet", "holidays", ["religious", "islamic"]],
    ["Buddha's Birthday", "holidays", ["religious"]],
    ["Birthday of the Buddha", "holidays", ["religious"]],
    ["Liberation Day", "holidays", ["national"]],
    ["Goa Liberation Day", "holidays", ["national"]],
    ["Liberation from Fascism", "holidays", ["national"]],
    ["Constitution Day", "holidays", ["national"]],
    ["Constitutional Day", "holidays", ["national"]],
    ["Puerto Rico Constitution Day", "holidays", ["national"]],
    ["Labour Day", "holidays", ["labor"]],
    ["Arrival of Indentured Labourers", "holidays", ["labor"]],
    ["Workers' Day", "holidays", ["labor"]],
    ["Memorial Day", "holidays", ["remembrance"]],
    ["Genocide Memorial Day", "holidays", ["remembrance"]],
    ["Veterans Day", "holidays", ["remembrance"]],
    ["Day of the Veterans and the Fallen in the Malvinas War", "holidays", ["remembrance"]],
    ["National Heroes' Day", "holidays", ["remembrance"]],
    ["Heroes Day", "holidays", ["remembrance"]],
    ["Heroes’ and Forefathers Day", "holidays", ["remembrance"]],
    // Anchoring `ces` in the tech rule stopped these six being conferences and left them matching
    // nothing; they are remembrance holidays, not the absence of a holiday.
    ["Armed Forces Day", "holidays", ["remembrance"]],
    ["Armed forces Day", "holidays", ["remembrance"]],
    ["Armed Forces Day (substitute day)", "holidays", ["remembrance"]],
    ["Azerbaijan Armed Forces Day", "holidays", ["remembrance"]],
    ["Defence Forces Day", "holidays", ["remembrance"]],
    ["Victory of Armed Forces Day", "holidays", ["remembrance"]],
    ["Journée de la Révolution et des Forces Armées", "holidays", ["remembrance"]],
    ["King's Birthday", "holidays", ["royal"]],
    ["Queen's Birthday", "holidays", ["royal"]],
    ["Emperor's Birthday", "holidays", ["royal"]],
    ["Sultan of Johor's Birthday", "holidays", ["royal"]],
    ["Hari Keputeraan Sultan Kedah", "holidays", ["royal"]],
    ["Queen’s Platinum Jubilee", "holidays", ["royal"]],
    ["King Charles III's Coronation", "holidays", ["royal"]],
    ["King's Day", "holidays", ["royal"]],
    ["Birthday of Queen Sonja", "holidays", ["royal"]],
    ["Valentine's Day", "culture", ["romance"]],
    ["Día de San Valentín", "culture", ["romance"]],
    ["World Oceans Day", "nature", ["earth"]],
    ["World Environment Day", "nature", ["earth"]],
    ["Earth Day", "nature", ["earth"]],
    ["Children's Day", "culture", ["family"]],
    ["International Children's Day", "culture", ["family"]],
    ["National Youth Day", "culture", ["family"]],
    ["Family Day", "culture", ["family"]],
    ["Election Day", "politics", ["elections"]],
    ["Presidential Election Day", "politics", ["elections"]],
    ["CES 2027", "tech", ["conference"]],
    ["Boston Marathon 2026", "sports", ["sports"]],
    ["Milano Cortina 2026 Winter Olympics", "sports", ["sports"]],
    ["Paralympic Games", "sports", ["sports"]],
    ["Perseid meteor shower peak", "astronomy", ["sky"]],
    ["Wigilia Bożego Narodzenia", "holidays", ["christmas", "religious"]],
    ["Drugi dzień Bożego Narodzenia", "holidays", ["christmas", "religious"]],
    ["Natale di Gesù", "holidays", ["christmas", "religious"]],
    ["Ascensione", "holidays", ["religious", "christian"]],
    ["Assumption (substitute day)", "holidays", ["religious", "christian"]],
  ];
  it.each(cases)("%s", (title, category, tags) => {
    expect(classify(title, "curiosities")).toEqual({ category, tags });
  });
});

describe("buildEvent tag length", () => {
  it("clamps a long tag instead of letting the schema reject the whole row", () => {
    // slugify() caps at 80 characters, IngestEventSchema caps a tag at 60 — so a tag built from a
    // long enough name fails validation, and prepareRows drops a failing row whole rather than the
    // offending tag. The row is worth more than the facet. (That a live adapter has produced such
    // a name is not claimed; the assertion below is that the schema rejects the shape.)
    const tour = "Nick Cave and the Bad Seeds Wild God World Tour European Leg 2027";
    expect(slugify(tour).length).toBeGreaterThan(TAG_MAX);
    const ev = buildEvent({ title: "Wild God Tour", date: "2027-03-01", category: "music", tags: ["tour", tour], source: "curated" });
    expect(ev.tags[1]).toHaveLength(TAG_MAX);
    expect(ev.tags[1].endsWith("-")).toBe(false);
    expect(ev.tags[0]).toBe("tour"); // short tags are untouched
    expect(IngestEventSchema.safeParse(ev).success).toBe(true);
    // …and this is what reaches the schema when the clamp is not there.
    expect(IngestEventSchema.safeParse({ ...ev, tags: [slugify(tour)] }).success).toBe(false);
  });

  it("drops the trailing dash a mid-word cut leaves, and dedupes tags that clamp to the same slug", () => {
    const ev = buildEvent({
      title: "Festival",
      date: "2027-06-01",
      category: "festivals",
      // 60 characters land mid-word, so the naive slice ends in "-".
      tags: ["The Very Long Name Of A Touring Festival That Keeps Going On A", "The Very Long Name Of A Touring Festival That Keeps Going On B"],
      source: "curated",
    });
    expect(ev.tags).toHaveLength(1);
    expect(ev.tags[0]).toBe("the-very-long-name-of-a-touring-festival-that-keeps-going-on");
    expect(IngestEventSchema.safeParse(ev).success).toBe(true);
  });

  it("keeps TAG_MAX and TAGS_MAX in step with the schema they mirror", () => {
    // types.ts owns the caps; normalize.ts has to hold a copy because it clamps before the row
    // ever reaches the schema. This pins the copy to the original: move one cap and the mismatch
    // surfaces here, instead of as whole rows silently failing validation during an ingest.
    const row = buildEvent({ title: "Boundary", date: "2027-01-01", category: "culture", source: "curated" });
    const accepts = (tags: string[]) => IngestEventSchema.safeParse({ ...row, tags }).success;
    expect(accepts(["x".repeat(TAG_MAX)])).toBe(true);
    expect(accepts(["x".repeat(TAG_MAX + 1)])).toBe(false);
    expect(accepts(Array.from({ length: TAGS_MAX }, (_, i) => `t${i}`))).toBe(true);
    expect(accepts(Array.from({ length: TAGS_MAX + 1 }, (_, i) => `t${i}`))).toBe(false);
  });

  it("caps the number of tags at the schema's limit", () => {
    const ev = buildEvent({
      title: "Many tags",
      date: "2027-06-01",
      category: "culture",
      tags: Array.from({ length: TAGS_MAX + 10 }, (_, i) => `tag-${i}`),
      source: "curated",
    });
    expect(ev.tags).toHaveLength(TAGS_MAX);
    expect(IngestEventSchema.safeParse(ev).success).toBe(true);
  });
});
