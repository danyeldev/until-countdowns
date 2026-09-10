function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-ink-2 ${className}`} aria-hidden="true" />;
}

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading the catalog">
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
