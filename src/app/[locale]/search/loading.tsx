export default function SearchLoading() {
  return (
    <div className="reveal">
      <div className="mb-7 h-10 w-64 animate-pulse rounded-xl bg-white/5" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-3xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
