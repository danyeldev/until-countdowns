export default function SeriesLoading() {
  return (
    <div className="reveal">
      <div className="h-10 w-72 animate-pulse rounded-xl bg-white/5" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
