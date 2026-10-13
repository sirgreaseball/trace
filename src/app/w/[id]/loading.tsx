export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="fade-in space-y-8">
      <div className="space-y-4">
        <div className="skeleton h-3.5 w-36" />
        <div className="skeleton h-11 w-[min(420px,80%)] rounded-[14px]" />
        <div className="skeleton h-4 w-[min(560px,90%)]" />
      </div>
      <div className="skeleton h-72 rounded-[32px]" />
      <div className="grid gap-8 lg:grid-cols-[1.45fr_1fr]">
        <div className="skeleton h-64 rounded-[22px]" />
        <div className="skeleton h-64 rounded-[22px]" />
      </div>
    </div>
  );
}
