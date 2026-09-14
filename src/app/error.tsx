"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      role="alert"
      className="mx-auto max-w-xl py-16 text-center sm:py-24"
    >
      <Icon name="clock" size={36} className="mx-auto text-amber" />
      <p className="eyebrow mt-6">Give it a moment</p>
      <h1 className="mt-4 page-heading">The future is still here.</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        We couldn’t load these dates just now. Try again in a moment, or make a
        countdown of your own.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="button-primary">
          Try again
        </button>
        <Link href="/create" className="button-secondary">
          Create a countdown
        </Link>
      </div>
    </section>
  );
}
