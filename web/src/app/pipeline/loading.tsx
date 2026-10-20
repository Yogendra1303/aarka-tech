// Matches the Applications board so the page doesn't flash an older layout while it loads.
export default function ApplicationsLoading() {
  const bar = "animate-pulse rounded-lg bg-surface-hover";
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 max-sm:px-4" aria-label="Loading applications" role="status">
      <span className="sr-only">Loading applications…</span>
      <div className={`${bar} h-8 w-48`} />
      <div className={`${bar} mt-2 h-4 w-80 max-w-full`} />
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={`${bar} h-20`} />)}</div>
      <div className={`${bar} mt-4 h-12`} />
      <div className="mt-4 flex gap-3 overflow-hidden">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bar} h-72 w-[19.5rem] shrink-0`} />)}</div>
    </div>
  );
}
