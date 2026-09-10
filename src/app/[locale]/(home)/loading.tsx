import { i18n } from "@/lib/i18n/server";

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-ink-2 ${className}`} aria-hidden="true" />;
}

/**
 * Async only for its one string: the locale is a root parameter, so reading it costs no request
 * data and leaves the skeleton as prerenderable as it was.
 */
export default async function Loading() {
  const L = await i18n();
  return (
    <div aria-busy="true" aria-label={L.m.home.loading}>
      <Skeleton className="h-72 rounded-3xl sm:h-96" />
      <div className="mt-14 flex items-end justify-between">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-7 w-56 rounded-full" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-52" />
        ))}
      </div>
    </div>
  );
}
