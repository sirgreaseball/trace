export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-6">
      <div className="space-y-3">
        <div className="h-3 w-24 rounded bg-bg-3" />
        <div className="h-8 w-72 rounded-lg bg-bg-3" />
      </div>
      <div className="h-44 rounded-2xl bg-bg-3/70" />
      <div className="h-64 rounded-2xl bg-bg-3/50" />
    </div>
  );
}
