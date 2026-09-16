"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { createAuthBrowserClient } from "@/lib/auth/browser";
import { safeNextPath } from "@/lib/auth/paths";
import {
  REPORT_BODY_MAX,
  REPORT_KINDS,
  rememberPendingReport,
  takePendingReport,
  type ReportKind,
} from "@/lib/reports";
import { createEventReport } from "@/lib/reports-client";
import { AuthDialog } from "./AuthDialog";
import { Icon } from "./Icon";

export function ReportEventButton({
  eventId,
  eventKey,
  title,
}: {
  eventId: string;
  eventKey: string;
  title: string;
}) {
  const pathname = usePathname();
  const { ready, userId } = useCollection();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [kind, setKind] = useState<ReportKind>("wrong_date");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const node = dialog.current;
    if (!open) {
      node?.close();
      return;
    }
    if (node && !node.open) node.showModal();
  }, [open]);

  useEffect(() => {
    if (!ready || !userId) return;
    const pendingReport = takePendingReport();
    if (!pendingReport) return;
    if (pendingReport.eventId !== eventId) {
      rememberPendingReport(pendingReport);
      return;
    }
    void Promise.resolve().then(() => {
      setKind(pendingReport.kind);
      setBody(pendingReport.body);
      setOpen(true);
      setPending(true);
      setError("");
      void createEventReport(createAuthBrowserClient(), pendingReport)
        .then(() => {
          setSent(true);
          setError("");
        })
        .catch((cause) => {
          setError(cause instanceof Error ? cause.message : "Could not send that note. Try again.");
        })
        .finally(() => setPending(false));
    });
  }, [eventId, ready, userId]);

  function close() {
    setOpen(false);
    setAuthOpen(false);
    setError("");
    if (sent) {
      setSent(false);
      setBody("");
      setKind("wrong_date");
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const draft = { eventId, eventKey, kind, body };
    if (!userId) {
      rememberPendingReport(draft);
      setOpen(false);
      setAuthOpen(true);
      return;
    }
    setPending(true);
    setError("");
    try {
      await createEventReport(createAuthBrowserClient(), draft);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send that note. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="mt-2 inline-flex min-h-11 items-center text-xs text-paper-dim underline decoration-line underline-offset-4 hover:text-paper"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Request a change
      </button>
      {open ? (
        <dialog
          ref={dialog}
          className="auth-dialog"
          onClose={close}
          onClick={(click) => {
            if (click.target === dialog.current) close();
          }}
          aria-labelledby="event-report-title"
        >
          <button
            type="button"
            className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-xl text-muted transition hover:bg-white/5 hover:text-paper"
            aria-label="Close"
            onClick={close}
          >
            <Icon name="close" size={16} />
          </button>
          {sent ? (
            <div>
              <h2 id="event-report-title" className="pr-10 text-2xl font-semibold tracking-tight text-pretty">
                Thanks. We’ll look at this.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Your note about {title} is with us. Public listings take a little time to update.
              </p>
              <button type="button" className="button-primary mt-6" onClick={close}>
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={(formEvent) => void onSubmit(formEvent)}>
              <h2 id="event-report-title" className="pr-10 text-2xl font-semibold tracking-tight text-pretty">
                What’s off about this countdown?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Report a problem or suggest a better date, title, or detail for {title}.
              </p>
              <fieldset className="mt-6">
                <legend className="field-label">What needs changing</legend>
                <div className="space-y-1">
                  {REPORT_KINDS.map((option) => (
                    <label
                      key={option.id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-1 hover:bg-white/[.04]"
                    >
                      <input
                        type="radio"
                        name="report-kind"
                        value={option.id}
                        checked={kind === option.id}
                        onChange={() => setKind(option.id)}
                      />
                      <span className="text-sm text-paper">{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="mt-5 block">
                <span className="field-label">What should it say instead?</span>
                <textarea
                  className="field mt-2 min-h-28 resize-y"
                  maxLength={REPORT_BODY_MAX}
                  required
                  minLength={8}
                  value={body}
                  placeholder="The opening ceremony is 19 September, not the 18th."
                  onChange={(change) => setBody(change.target.value)}
                />
              </label>
              <button type="submit" className="button-primary mt-5 w-full" disabled={pending || body.trim().length < 8}>
                {pending ? "Sending…" : "Send request"}
              </button>
              {error ? (
                <p role="alert" className="mt-3 text-xs leading-relaxed text-ember">
                  {error}
                </p>
              ) : null}
            </form>
          )}
        </dialog>
      ) : null}
      {authOpen ? (
        <AuthDialog
          next={safeNextPath(pathname)}
          heading="Sign in to send this."
          subtitle="Use Google or your email. We’ll send your change request after you sign in."
          onClose={() => setAuthOpen(false)}
        />
      ) : null}
    </>
  );
}
