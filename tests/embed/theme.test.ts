import { describe, expect, it } from "vitest";
import {
  DEFAULT_EMBED_THEME,
  DONE_MAX,
  EMBED_PRESETS,
  PADDING_MAX,
  RADIUS_MAX,
  SCALE_MAX,
  SCALE_MIN,
  STREAM_EMBED_THEME,
  embedIframeSnippet,
  embedPath,
  embedQuery,
  embedUrl,
  parseBackground,
  parseColor,
  parseEmbedTheme,
  presetTheme,
  type EmbedTheme,
} from "@/lib/embed/theme";

function parse(query: string, fallback?: EmbedTheme) {
  return parseEmbedTheme(new URLSearchParams(query), fallback);
}

describe("parseColor", () => {
  it("normalises the accepted shapes to #rrggbb", () => {
    expect(parseColor("#F0A202")).toBe("#f0a202");
    expect(parseColor("f0a202")).toBe("#f0a202");
    expect(parseColor("#fa2")).toBe("#ffaa22");
    expect(parseColor(" #fa2 ")).toBe("#ffaa22");
  });

  it("refuses anything that is not a hex colour", () => {
    // The parser is the security boundary: these values end up inside generated CSS.
    for (const bad of [
      "red",
      "rgb(1,2,3)",
      "#f0a20",
      "#f0a2022",
      "url(https://evil.example/x)",
      "#f0a202;background:url(x)",
      "expression(alert(1))",
      "var(--ink)",
      "",
      undefined,
    ]) {
      expect(parseColor(bad as string | undefined)).toBeNull();
    }
  });
});

describe("parseBackground", () => {
  it("accepts the words that mean 'let the scene through'", () => {
    for (const word of ["transparent", "none", "clear", "chroma", "TRANSPARENT"]) {
      expect(parseBackground(word)).toBe("transparent");
    }
  });

  it("still refuses a non-colour", () => {
    expect(parseBackground("rgba(0,0,0,0)")).toBeNull();
  });
});

describe("parseEmbedTheme", () => {
  it("returns the default theme for an empty query", () => {
    expect(parse("")).toEqual(DEFAULT_EMBED_THEME);
  });

  it("starts from the named preset", () => {
    expect(parse("preset=clear").bg).toBe("transparent");
    expect(parse("preset=clear").frame).toBe("none");
    expect(parse("theme=mono").font).toBe("mono");
    expect(parse("theme=mono").glow).toBe(false);
  });

  it("lets explicit values win over the preset", () => {
    const theme = parse("preset=clear&accent=39ff88&bg=%23101010&frame=card");
    expect(theme.preset).toBe("clear");
    expect(theme.accent).toBe("#39ff88");
    expect(theme.bg).toBe("#101010");
    expect(theme.frame).toBe("card");
  });

  it("falls back to the preset for anything malformed", () => {
    const theme = parse("accent=nonsense&layout=spiral&pos=mars&units=xyz&scale=abc&frame=neon");
    expect(theme.accent).toBe(DEFAULT_EMBED_THEME.accent);
    expect(theme.layout).toBe(DEFAULT_EMBED_THEME.layout);
    expect(theme.position).toBe(DEFAULT_EMBED_THEME.position);
    expect(theme.units).toBe(DEFAULT_EMBED_THEME.units);
    expect(theme.scale).toBe(DEFAULT_EMBED_THEME.scale);
    expect(theme.frame).toBe(DEFAULT_EMBED_THEME.frame);
  });

  it("clamps every number to its range", () => {
    expect(parse("scale=9999").scale).toBe(SCALE_MAX);
    expect(parse("scale=-40").scale).toBe(SCALE_MIN);
    expect(parse("scale=137.6").scale).toBe(138);
    expect(parse("radius=999").radius).toBe(RADIUS_MAX);
    expect(parse("radius=-1").radius).toBe(0);
    expect(parse("pad=999").padding).toBe(PADDING_MAX);
  });

  it("reads the booleans people actually type", () => {
    expect(parse("labels=0").labels).toBe(false);
    expect(parse("labels=false").labels).toBe(false);
    expect(parse("labels=off").labels).toBe(false);
    expect(parse("brand=no").brand).toBe(false);
    expect(parse("trim=1").trim).toBe(true);
    expect(parse("trim=yes").trim).toBe(true);
    // A bare flag reads as "on"; an unparseable value keeps the preset's answer.
    expect(parse("trim").trim).toBe(true);
    expect(parse("trim=maybe").trim).toBe(DEFAULT_EMBED_THEME.trim);
  });

  it("collapses and clamps the finished message", () => {
    expect(parse(`done=${encodeURIComponent("  Stream\n  starts  now  ")}`).done).toBe("Stream starts now");
    expect(parse(`done=${"x".repeat(200)}`).done).toHaveLength(DONE_MAX);
  });

  it("takes the first occurrence of a repeated parameter", () => {
    expect(parse("scale=150&scale=200").scale).toBe(150);
    expect(parseEmbedTheme({ scale: ["150", "200"] }).scale).toBe(150);
  });

  it("accepts Next's plain search-param object and a missing one", () => {
    expect(parseEmbedTheme({ preset: "neon", labels: "0" }).labels).toBe(false);
    expect(parseEmbedTheme(undefined)).toEqual(DEFAULT_EMBED_THEME);
    expect(parseEmbedTheme(null)).toEqual(DEFAULT_EMBED_THEME);
  });

  it("uses the caller's fallback when no preset is named", () => {
    const theme = parseEmbedTheme(new URLSearchParams("scale=150"), STREAM_EMBED_THEME);
    expect(theme.bg).toBe("transparent");
    expect(theme.position).toBe("bottom-left");
    expect(theme.scale).toBe(150);
  });
});

describe("embedQuery", () => {
  it("is empty for the default theme", () => {
    expect(embedQuery(DEFAULT_EMBED_THEME)).toBe("");
  });

  it("carries the preset alone when nothing else moved", () => {
    expect(embedQuery(presetTheme("neon"))).toBe("preset=neon");
  });

  it("only serialises what differs from the preset", () => {
    const theme: EmbedTheme = { ...presetTheme("clear"), scale: 180, position: "bottom-right", brand: false };
    const usp = new URLSearchParams(embedQuery(theme));
    expect([...usp.keys()].sort()).toEqual(["brand", "pos", "preset", "scale"]);
    expect(usp.get("brand")).toBe("0");
    expect(usp.get("pos")).toBe("bottom-right");
    // The transparent background is the `clear` preset's own value, so it stays out of the URL.
    expect(usp.get("bg")).toBeNull();
  });

  it("round-trips every preset through parse", () => {
    for (const preset of EMBED_PRESETS) {
      const theme = presetTheme(preset);
      expect(parse(embedQuery(theme))).toEqual(theme);
    }
  });

  it("round-trips a heavily customised theme", () => {
    const theme: EmbedTheme = {
      ...presetTheme("light"),
      accent: "#123456",
      text: "#abcdef",
      bg: "transparent",
      font: "serif",
      scale: 245,
      layout: "big",
      position: "top-right",
      units: "hms",
      frame: "outline",
      separator: "dot",
      radius: 4,
      padding: 72,
      labels: false,
      title: false,
      date: true,
      note: true,
      brand: false,
      glow: false,
      trim: true,
      done: "Doors open!",
    };
    expect(parse(embedQuery(theme))).toEqual(theme);
  });

  it("escapes the colour hash so the query survives a URL", () => {
    const query = embedQuery({ ...DEFAULT_EMBED_THEME, accent: "#123456" });
    expect(query).toContain("accent=%23123456");
    expect(query).not.toContain("#");
  });
});

describe("urls and snippets", () => {
  it("builds a bare path when the theme is the default", () => {
    expect(embedPath("christmas", DEFAULT_EMBED_THEME)).toBe("/embed/christmas");
  });

  it("encodes the slug and appends the query", () => {
    const path = embedPath("share-a/b", { ...DEFAULT_EMBED_THEME, scale: 150 });
    expect(path).toBe("/embed/share-a%2Fb?scale=150");
  });

  it("joins an origin without doubling the slash", () => {
    expect(embedUrl("https://until.test/", "x", DEFAULT_EMBED_THEME)).toBe("https://until.test/embed/x");
  });

  it("gives the width a unit in the style and none in the attribute", () => {
    // `width:480` without a unit is an invalid declaration the browser drops on the floor.
    const numeric = embedIframeSnippet("https://until.test/embed/x", "X", { width: 480, height: 220 });
    expect(numeric).toContain('width="480"');
    expect(numeric).toContain("width:480px");
    const relative = embedIframeSnippet("https://until.test/embed/x", "X");
    expect(relative).toContain('width="100%"');
    expect(relative).toContain("width:100%");
  });

  it("escapes the snippet's attributes", () => {
    const html = embedIframeSnippet(
      'https://until.test/embed/x?done=a"b',
      'Bob\'s "big" <day>',
      { width: "100%", height: 220 },
    );
    expect(html).not.toContain('?done=a"b');
    expect(html).toContain("&quot;");
    expect(html).not.toContain("<day>");
    expect(html.startsWith("<iframe ")).toBe(true);
    expect(html.endsWith("></iframe>")).toBe(true);
  });
});
