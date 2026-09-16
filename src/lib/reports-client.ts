import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import {
  parseReportBody,
  parseReportEventId,
  parseReportKind,
  reportErrorMessage,
  type ReportKind,
} from "./reports";

type ReportClient = SupabaseClient<Database>;

export async function createEventReport(
  client: ReportClient,
  input: { eventId: string; eventKey: string; kind: ReportKind; body: string },
): Promise<void> {
  const eventId = parseReportEventId(input.eventId);
  const eventKey = parseReportEventId(input.eventKey);
  const kind = parseReportKind(input.kind);
  const body = parseReportBody(input.body);
  if (!eventId || !eventKey) throw new Error("This countdown cannot collect change requests.");
  if (!kind) throw new Error("Choose what needs changing.");
  if (!body) throw new Error("Tell us what should change.");

  const { error } = await client.from("event_reports").insert({
    event_id: eventId,
    event_key: eventKey,
    kind,
    body,
  });
  if (error) throw new Error(reportErrorMessage(error));
}
