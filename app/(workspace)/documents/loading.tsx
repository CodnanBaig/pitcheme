export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading documents">
      <div className="space-y-3">
        <div className="h-4 w-40 rounded bg-muted motion-safe:animate-pulse" />
        <div className="h-9 w-64 max-w-full rounded bg-muted motion-safe:animate-pulse" />
        <div className="h-4 w-96 max-w-full rounded bg-muted/80 motion-safe:animate-pulse" />
      </div>
      <div className="h-24 rounded-xl border border-border bg-card/60 motion-safe:animate-pulse" />
      <div className="h-80 rounded-xl border border-border bg-card/60 motion-safe:animate-pulse" />
    </div>
  )
}
