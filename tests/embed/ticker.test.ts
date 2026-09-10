import { describe, expect, it } from "vitest";
import { buildEmbedDocument, type EmbedSubject } from "@/lib/embed/html";
import { DEFAULT_EMBED_THEME, type EmbedTheme } from "@/lib/embed/theme";

/**
 * The inline ticker is a string this process never executes in a browser, so run it here: extract
 * it, hand it a stub DOM and a clock it does not control, and drive it. `document`, `setInterval`,
 * `clearInterval` and `Date` arrive as parameters, which shadow the globals inside the function.
 */

const SUBJECT: EmbedSubject = {
  slug: "new-years-day-2027-01-01",
  title: "New Year's Day",
  description: "The first day of the Gregorian year.",
  date: "2027-01-01",
  allDay: true,
  href: "https://until.test/event/new-years-day-2027-01-01",
};

type Node = { style: { display: string }; textContent: string };

function node(display = ""): Node {
  return { style: { display }, textContent: "" };
}

function stubDom(html: string) {
  // Seed from what the server actually emitted: `.done` is `display:none` in the stylesheet, and a
  // finished countdown ships with the clock hidden and the done line already up.
  const clock = node(/id="clock" style="display:none"/.test(html) ? "none" : "");
  const done = node(/id="done" style="display:block"/.test(html) ? "block" : "none");
  const cells = new Map<string, Node>();
  const document = {
    getElementById: (id: string) => (id === "clock" ? clock : id === "done" ? done : null),
    querySelector: (selector: string) => {
      const existing = cells.get(selector);
      if (existing) return existing;
      const fresh = node();
      cells.set(selector, fresh);
      return fresh;
    },
  };
  return { document, clock, done, cells };
}

/** A `Date` whose "now" the test moves, so a countdown can be walked across its own boundary. */
function movableDate(start: number) {
  const state = { now: start };
  const Real = Date;
  function Fake(this: unknown, ...args: unknown[]) {
    return args.length === 0 ? new Real(state.now) : new (Real as unknown as new (...a: unknown[]) => Date)(...args);
  }
  Fake.now = () => state.now;
  Fake.parse = Real.parse;
  Fake.UTC = Real.UTC;
  return { state, Fake: Fake as unknown as DateConstructor };
}

function run(html: string, start: number) {
  const source = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (!source) throw new Error("no ticker in the document");
  const dom = stubDom(html);
  const { state, Fake } = movableDate(start);
  let live: { ms: number; fn: () => void } | null = null;
  const setIntervalStub = (fn: () => void, ms: number) => {
    live = { ms, fn };
    return 1;
  };
  const clearIntervalStub = () => {
    live = null;
  };

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const ticker = new Function("document", "setInterval", "clearInterval", "Date", source[1]);
  ticker(dom.document, setIntervalStub, clearIntervalStub, Fake);

  return {
    ...dom,
    /** Move the clock and let the ticker's own interval fire once. */
    advance(to: number) {
      state.now = to;
      (live as unknown as { fn: () => void } | null)?.fn();
    },
    get rate() {
      return (live as unknown as { ms: number } | null)?.ms ?? null;
    },
  };
}

/** Local midnight on the event's day, which is what the ticker counts down to. */
const TARGET = new Date(2027, 0, 1).getTime();
const HOUR = 3_600_000;
const DAY = 86_400_000;

function build(theme: Partial<EmbedTheme> = {}, now = Date.UTC(2026, 11, 25)) {
  return buildEmbedDocument(SUBJECT, { ...DEFAULT_EMBED_THEME, ...theme }, { now });
}

describe("the ticker, driven", () => {
  it("writes the units it was given", () => {
    const ticker = run(build(), TARGET - 3 * DAY - 4 * HOUR);
    expect(ticker.cells.get('[data-v="d"]')?.textContent).toBe("03");
    expect(ticker.cells.get('[data-v="h"]')?.textContent).toBe("04");
    expect(ticker.rate).toBe(250);
  });

  it("lets the largest enabled unit absorb everything above it", () => {
    const ticker = run(build({ units: "hms" }), TARGET - 3 * DAY - 4 * HOUR);
    expect(ticker.cells.get('[data-v="h"]')?.textContent).toBe("76");
  });

  it("only pays for a sub-second interval when seconds are on the clock", () => {
    expect(run(build({ units: "dhms" }), TARGET - DAY).rate).toBe(250);
    expect(run(build({ units: "dhm" }), TARGET - DAY).rate).toBe(1000);
  });

  it("trims leading zero units together with their separators, never the last one", () => {
    const ticker = run(build({ trim: true }), TARGET - 90_000);
    expect(ticker.cells.get('[data-u="d"]')?.style.display).toBe("none");
    expect(ticker.cells.get('[data-after="d"]')?.style.display).toBe("none");
    expect(ticker.cells.get('[data-u="h"]')?.style.display).toBe("none");
    expect(ticker.cells.get('[data-u="m"]')?.style.display).toBe("");
    expect(ticker.cells.get('[data-v="m"]')?.textContent).toBe("01");
  });

  it("un-hides a clock the server rendered as finished", () => {
    // The server decides from UTC, the ticker from the viewer's own midnight: west of UTC a
    // document that shipped "finished" still has hours to run, and must swap back.
    const html = build({}, Date.UTC(2027, 0, 1, 1));
    expect(html).toContain('id="clock" style="display:none"');

    const ticker = run(html, TARGET - 3 * HOUR);
    expect(ticker.clock.style.display).toBe("");
    expect(ticker.done.style.display).toBe("none");
    expect(ticker.cells.get('[data-v="h"]')?.textContent).toBe("03");
  });

  it("swaps to the finished line when the clock runs out, and keeps a slow pulse", () => {
    const ticker = run(build(), TARGET - 2000);
    expect(ticker.clock.style.display).toBe("");

    ticker.advance(TARGET + 1000);
    expect(ticker.clock.style.display).toBe("none");
    expect(ticker.done.style.display).toBe("block");
    expect(ticker.done.textContent).toBe("It's here.");
    // A finished countdown does not stop: the day still has to turn over.
    expect(ticker.rate).toBe(60_000);

    ticker.advance(TARGET + DAY + HOUR);
    expect(ticker.done.textContent).toBe("This one already happened.");
  });

  it("keeps a custom finished message on both sides of the day", () => {
    const ticker = run(build({ done: "Doors open" }), TARGET - 2000);
    ticker.advance(TARGET + 1000);
    expect(ticker.done.textContent).toBe("Doors open");
    ticker.advance(TARGET + DAY + HOUR);
    expect(ticker.done.textContent).toBe("Doors open");
  });

  it("swaps the day caption between 1 and 2 days out", () => {
    const ticker = run(build(), TARGET - DAY - 1000);
    expect(ticker.cells.get('[data-u="d"] .l')?.textContent).toBe("day");
    const plural = run(build(), TARGET - 2 * DAY - 1000);
    expect(plural.cells.get('[data-u="d"] .l')?.textContent).toBe("days");
  });
});
