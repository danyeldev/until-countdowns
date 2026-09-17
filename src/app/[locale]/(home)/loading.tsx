function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-surface ${className}`} aria-hidden="true" />;
}

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading the catalog">
      <Skeleton className="h-10 w-72 rounded-lg" />
      <Skeleton className="mt-4 h-4 w-96 rounded" />
      <Skeleton className="mt-8 h-72 rounded-3xl sm:h-96" />
      <div className="mt-14 flex items-end justify-between">
        <Skeleton className="h-7 w-48 rounded-lg" />
        <Skeleton className="h-9 w-56 rounded-xl" />
      </div>
      <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[1.6]" />
            <Skeleton className="mt-4 h-3 w-24 rounded" />
            <Skeleton className="mt-2 h-5 w-3/4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
