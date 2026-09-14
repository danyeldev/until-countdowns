"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/Icon";

/** A failed catalog read remains a retryable 500 rather than a cached missing date. */
export default function EventError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="panel mx-auto max-w-2xl rounded-[28px] border border-line bg-ink-2 px-6 py-12 text-center sm:px-10 sm:py-16">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-ink text-amber">
        <Icon name="clock" size={25} />
      </div>
      <p className="mt-6 text-sm font-medium text-amber">
        Connection interrupted
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
        Let’s try that countdown again.
      </h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">
        The catalog couldn’t be reached. Try again to load this date, or keep
        exploring.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="button-primary">
          Try again
        </button>
        <Link href="/" className="button-secondary">
          Explore countdowns
        </Link>
      </div>
    </section>
  );
}
