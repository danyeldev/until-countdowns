"use client";

import { useEffect, useRef, useState } from "react";
import type { AuthMode } from "@/lib/auth/paths";
import { AuthForm } from "./AuthForm";
import { Icon } from "./Icon";

export function AuthDialog({
  next,
  onClose,
  heading = "Sign in to continue.",
  subtitle = "Use Google or your email.",
  initialMode = "signin",
}: {
  next: string;
  onClose: () => void;
  heading?: string;
  subtitle?: string;
  initialMode?: AuthMode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<AuthMode>(initialMode);

  useEffect(() => {
    const node = dialog.current;
    if (!node || node.open) return;
    node.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="auth-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      aria-labelledby="auth-dialog-title"
    >
      <AuthForm
        mode={mode}
        next={next}
        layout="dialog"
        headingId="auth-dialog-title"
        dialogHeading={heading}
        dialogSubtitle={subtitle}
        onModeChange={setMode}
      />
      <button
        type="button"
        className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-xl text-muted transition hover:bg-white/5 hover:text-paper"
        aria-label="Close"
        onClick={onClose}
      >
        <Icon name="close" size={16} />
      </button>
    </dialog>
  );
}
