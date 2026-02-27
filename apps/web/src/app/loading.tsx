export default function Loading() {
  return (
    <div className="space-y-6 py-10">
      <div className="h-52 animate-pulse rounded-[2rem] bg-white/70" />
      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="h-80 animate-pulse rounded-3xl bg-white/70" />
        ))}
      </div>
    </div>
  );
}
