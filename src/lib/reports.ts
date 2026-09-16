import { isCatalogEventId } from "./event-id";

export const REPORT_BODY_MIN = 8;
export const REPORT_BODY_MAX = 1000;

export const REPORT_KINDS = [
  { id: "wrong_date", label: "The date or time is wrong" },
  { id: "wrong_details", label: "The title, place, or description is off" },
  { id: "outdated", label: "This countdown is outdated or cancelled" },
  { id: "other", label: "Something else" },
] as const;

export type ReportKind = (typeof REPORT_KINDS)[number]["id"];

export type PendingReport = {
  eventId: string;
  eventKey: string;
  kind: ReportKind;
  body: string;
};

export function parseReportEventId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return isCatalogEventId(value) ? value : null;
}

export function parseReportKind(value: unknown): ReportKind | null {
  return REPORT_KINDS.some((kind) => kind.id === value) ? (value as ReportKind) : null;
}

export function parseReportBody(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const body = value.replace(/\r\n/g, "\n").trim();
  if (body.length < REPORT_BODY_MIN || body.length > REPORT_BODY_MAX) return null;
  return body;
}

export function reportErrorMessage(error: { message?: string; code?: string } | string | null | undefined): string {
  if (!error) return "Could not send that note. Try again.";
  const message = typeof error === "string" ? error : error.message?.trim() || "";
  const code = typeof error === "string" ? "" : error.code?.trim() || "";
  if (/report_event_limit/.test(message)) return "You have already sent notes about this countdown.";
  if (/report_day_limit/.test(message)) return "You have sent enough notes for today. Try again tomorrow.";
  if (/event_missing/.test(message)) return "This countdown is not open for changes.";
  if (/profile_missing/.test(message) || code === "42501" || /not authenticated|JWT/i.test(message)) {
    return "Sign in to send a change request.";
  }
  if (message && message.length < 160 && !/https?:\/\//i.test(message) && !/regular expression|permission denied|violates/i.test(message)) {
    return message;
  }
  return "Could not send that note. Try again.";
}

const PENDING_REPORT_KEY = "until:pending-report";

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function rememberPendingReport(value: PendingReport) {
  const store = sessionStore();
  if (!store || !parseReportEventId(value.eventId) || !parseReportEventId(value.eventKey)) return;
  if (!parseReportKind(value.kind) || !parseReportBody(value.body)) return;
  try {
    store.setItem(PENDING_REPORT_KEY, JSON.stringify(value));
  } catch {
    // Private mode and full quotas should not block the sign-in dialog.
  }
}

export function takePendingReport(): PendingReport | null {
  const store = sessionStore();
  if (!store) return null;
  try {
    const raw = store.getItem(PENDING_REPORT_KEY);
    if (!raw) return null;
    store.removeItem(PENDING_REPORT_KEY);
    const parsed = JSON.parse(raw) as PendingReport;
    const eventId = parseReportEventId(parsed.eventId);
    const eventKey = parseReportEventId(parsed.eventKey);
    const kind = parseReportKind(parsed.kind);
    const body = parseReportBody(parsed.body);
    if (!eventId || !eventKey || !kind || !body) return null;
    return { eventId, eventKey, kind, body };
  } catch {
    return null;
  }
}
