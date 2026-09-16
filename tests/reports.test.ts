import { describe, expect, it } from "vitest";
import {
  parseReportBody,
  parseReportEventId,
  parseReportKind,
  rememberPendingReport,
  reportErrorMessage,
  takePendingReport,
} from "@/lib/reports";

describe("parse report fields", () => {
  it("accepts catalog ids and rejects personal or share payloads", () => {
    expect(parseReportEventId("halloween-2026-10-31")).toBe("halloween-2026-10-31");
    expect(parseReportEventId("mine-birthday-2026-09-15")).toBeNull();
    expect(parseReportEventId("share-abc")).toBeNull();
    expect(parseReportEventId("")).toBeNull();
  });

  it("accepts known kinds only", () => {
    expect(parseReportKind("wrong_date")).toBe("wrong_date");
    expect(parseReportKind("wrong_details")).toBe("wrong_details");
    expect(parseReportKind("outdated")).toBe("outdated");
    expect(parseReportKind("other")).toBe("other");
    expect(parseReportKind("spam")).toBeNull();
  });

  it("keeps a short note and rejects fluff", () => {
    expect(parseReportBody("  Opening is the 19th.  ")).toBe("Opening is the 19th.");
    expect(parseReportBody("too")).toBeNull();
    expect(parseReportBody("x".repeat(1001))).toBeNull();
  });
});

describe("reportErrorMessage", () => {
  it("maps known database errors", () => {
    expect(reportErrorMessage({ message: "report_event_limit" })).toMatch(/already sent/);
    expect(reportErrorMessage({ message: "report_day_limit" })).toMatch(/tomorrow/);
    expect(reportErrorMessage({ message: "event_missing" })).toMatch(/not open/);
    expect(reportErrorMessage({ code: "42501" })).toMatch(/Sign in/);
  });
});

describe("pending report", () => {
  it("remembers a draft until it is taken once", () => {
    if (typeof sessionStorage === "undefined") {
      const data = new Map<string, string>();
      Object.defineProperty(globalThis, "sessionStorage", {
        configurable: true,
        value: {
          getItem: (key: string) => data.get(key) ?? null,
          setItem: (key: string, value: string) => {
            data.set(key, value);
          },
          removeItem: (key: string) => {
            data.delete(key);
          },
        },
      });
    }
    rememberPendingReport({
      eventId: "halloween-2026-10-31",
      eventKey: "halloween-2026-10-31",
      kind: "wrong_date",
      body: "It starts on the 17th.",
    });
    expect(takePendingReport()).toEqual({
      eventId: "halloween-2026-10-31",
      eventKey: "halloween-2026-10-31",
      kind: "wrong_date",
      body: "It starts on the 17th.",
    });
    expect(takePendingReport()).toBeNull();
    rememberPendingReport({
      eventId: "mine-birthday-2026-09-15",
      eventKey: "mine-birthday-2026-09-15",
      kind: "other",
      body: "This should not store.",
    });
    expect(takePendingReport()).toBeNull();
  });
});
