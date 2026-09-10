import { describe, expect, it } from "vitest";
import { buildEmbedDocument, buildEmbedNotFoundDocument, type EmbedSubject } from "@/lib/embed/html";
import { DEFAULT_EMBED_THEME, presetTheme, type EmbedTheme } from "@/lib/embed/theme";

/** 2026-12-25T00:00:00Z — a week of UTC days before the subject below. */
const NOW = Date.UTC(2026, 11, 25);

const SUBJECT: EmbedSubject = {
  slug: "new-years-day-2027-01-01",
  title: "New Year's Day",
  description: "The first day of the Gregorian year.",
  date: "2027-01-01",
  allDay: true,
  href: "https://until.test/event/new-years-day-2027-01-01",
};

function build(theme: Partial<EmbedTheme> = {}, subject: Partial<EmbedSubject> = {}) {
  return buildEmbedDocument({ ...SUBJECT, ...subject }, { ...DEFAULT_EMBED_THEME, ...theme }, { now: NOW });
}

/**
 * Everything before the ticker. The script carries both the selectors and both finished messages,
 * so an assertion about what is *drawn* has to stop at `<script`.
 */
function markup(html: string): string {
  return html.split("<script")[0];
}

describe("buildEmbedDocument", () => {
  it("is a complete standalone document", () => {
    const html = build();
    expect(html.toLowerCase().startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("</html>");
    expect(html).toContain('name="robots"');
    expect(html).toContain("noindex");
  });

  it("fetches nothing from anywhere else", () => {
    // The whole point of hand-building the document: one request, no framework, no webfont, and
    // nothing a stranger's page has to trust. The only absolute URL is the click-through.
    const html = build();
    const urls = html.match(/https?:\/\/[^\s"')]+/g) ?? [];
    expect(urls.every((url) => url.startsWith("https://until.test/"))).toBe(true);
  });

  it("escapes the subject's text", () => {
    const html = build(
      { note: true },
      {
        title: `Bob's "big" <day> & night`,
        description: "<img src=x onerror=alert(1)>",
      },
    );
    expect(html).not.toContain("<day>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;day&gt;");
    expect(html).toContain("&amp;");
  });

  it("cannot be broken out of by a title carrying a closing script tag", () => {
    const html = build({}, { title: "</script><script>alert(1)</script>" });
    // Exactly one real script element: the ticker.
    expect(html.match(/<script/g) ?? []).toHaveLength(1);
  });

  it("keeps a hostile finished message inert", () => {
    // `done` is the one free-text value that reaches the ticker's JSON config, so it is where a
    // `</script>` would close the element early if the `<` were not escaped inside the literal.
    const html = build({ done: '</script><img src=x onerror="alert(1)">' });
    expect(html.match(/<script/g) ?? []).toHaveLength(1);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("\\u003c");
  });
});

describe("the ticker", () => {
  function script(html: string): string {
    const match = /<script>([\s\S]*?)<\/script>/.exec(html);
    if (!match) throw new Error("no ticker in the document");
    return match[1];
  }

  it("parses as JavaScript", () => {
    // A syntax error here is a frozen clock on someone else's page, and nothing on this side of the
    // request would notice. `new Function` parses without running, so `document` never matters.
    expect(() => new Function(script(build()))).not.toThrow();
    expect(() => new Function(script(build({ layout: "big", units: "hm", trim: true })))).not.toThrow();
  });

  it("stays inside ES5", () => {
    // Some OBS installs still ship an embedded Chromium old enough to choke on anything newer.
    const src = script(build({ done: "Live now" }));
    expect(src).not.toMatch(/=>/);
    expect(src).not.toMatch(/`/);
    expect(src).not.toMatch(/\b(?:const|let|class)\s/);
  });

  it("ticks every second only when seconds are on the clock", () => {
    expect(script(build({ units: "dhms" }))).toContain("250");
    expect(script(build({ units: "dhm" }))).toContain("1000");
  });
});

describe("the clock", () => {
  it("renders the enabled units and no others", () => {
    const html = build({ units: "hms" });
    expect(html).not.toContain('data-v="d"');
    for (const unit of ["h", "m", "s"]) expect(html).toContain(`data-v="${unit}"`);
  });

  it("renders one unit for the big layout", () => {
    const html = markup(build({ layout: "big", units: "d" }));
    expect(html.match(/data-v="/g) ?? []).toHaveLength(1);
    expect(html).toContain('data-v="d"');
  });

  it("carries a first-paint figure computed from the given clock", () => {
    // Seven UTC days out, as the no-JS fallback; the inline ticker corrects to local midnight.
    expect(build()).toContain(">07<");
  });

  it("drops the labels when asked", () => {
    expect(build({ labels: true })).toContain("days");
    expect(build({ labels: false })).not.toContain(">days<");
  });

  it("puts a separator between units in a row, and none in a stack", () => {
    expect(markup(build({ layout: "row", separator: "colon" }))).toContain("data-after=");
    expect(markup(build({ layout: "stack" }))).not.toContain("data-after=");
  });

  it("suffixes the compact line with letters, or separates it when the labels are off", () => {
    const suffixed = markup(build({ layout: "compact", labels: true }));
    expect(suffixed).toContain('<span class="l">d</span>');
    expect(suffixed).not.toContain("data-after=");
    expect(markup(build({ layout: "compact", labels: false }))).toContain("data-after=");
  });

  it("ships a finished countdown finished, rather than flashing a row of zeros", () => {
    // 2027-01-02, a day after the subject: the clock is hidden and the done line is already up.
    const html = buildEmbedDocument(SUBJECT, DEFAULT_EMBED_THEME, { now: Date.UTC(2027, 0, 2) });
    expect(markup(html)).toContain('id="clock" style="display:none"');
    expect(markup(html)).toContain("This one already happened.");
    // On the day itself it reads as arrival, not as history.
    const onTheDay = markup(buildEmbedDocument(SUBJECT, DEFAULT_EMBED_THEME, { now: Date.UTC(2027, 0, 1, 9) }));
    expect(onTheDay).toContain("It&#39;s here.");
    expect(onTheDay).not.toContain("already happened");
    // A custom message replaces both.
    const custom = markup(
      buildEmbedDocument(SUBJECT, { ...DEFAULT_EMBED_THEME, done: "Doors open" }, { now: Date.UTC(2027, 0, 2) }),
    );
    expect(custom).toContain("Doors open");
    expect(custom).not.toContain("already happened");
  });
});

describe("the theme", () => {
  it("lets the scene through when the background is transparent", () => {
    const html = buildEmbedDocument(SUBJECT, presetTheme("clear"), { now: NOW });
    expect(html).toContain("transparent");
    expect(html).not.toContain("#161410");
  });

  it("scales every size from one custom property", () => {
    expect(build({ scale: 200 })).toContain("--scale:2");
    expect(build({ scale: 50 })).toContain("--scale:0.5");
  });

  it("positions the card on the nine-grid", () => {
    const bottomRight = build({ position: "bottom-right" });
    expect(bottomRight).toContain("flex-end");
    const topLeft = build({ position: "top-left" });
    expect(topLeft).toContain("flex-start");
  });

  it("links back only when the wordmark is shown", () => {
    const branded = build({ brand: true });
    expect(branded).toContain(`href="${SUBJECT.href}"`);
    expect(branded).toContain('rel="noopener"');
    const bare = build({ brand: false });
    expect(bare).not.toContain(`href="${SUBJECT.href}"`);
  });
});

describe("buildEmbedNotFoundDocument", () => {
  it("renders a legible card rather than a browser error", () => {
    const html = buildEmbedNotFoundDocument(DEFAULT_EMBED_THEME, "https://until.test");
    expect(html.toLowerCase().startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("https://until.test");
    expect(html).not.toContain(SUBJECT.title);
  });
});
