export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading proposal generator">
      <div className="space-y-3">
        <div className="h-4 w-44 rounded bg-muted motion-safe:animate-pulse" />
        <div className="h-9 w-72 max-w-full rounded bg-muted motion-safe:animate-pulse" />
        <div className="h-4 w-full max-w-xl rounded bg-muted/80 motion-safe:animate-pulse" />
      </div>
      <div className="h-[38rem] rounded-xl border border-border bg-card/60 motion-safe:animate-pulse" />
    </div>
  )
}
