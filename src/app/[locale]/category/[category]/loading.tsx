export default function CategoryLoading() {
  return (
    <div className="reveal">
      <div className="h-10 w-56 animate-pulse rounded-xl bg-white/5" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-3xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
