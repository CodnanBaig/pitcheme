export default function Loading() {
  return (
    <div className="min-h-screen bg-background" aria-busy="true" aria-label="Loading proposal generator">
      <div className="h-16 border-b border-border bg-background/95" />
      <div className="container mx-auto space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/15 motion-safe:animate-pulse" />
          <div className="mx-auto h-9 w-64 rounded bg-muted motion-safe:animate-pulse" />
          <div className="mx-auto h-4 w-full max-w-xl rounded bg-muted/80 motion-safe:animate-pulse" />
        </div>
        <div className="mx-auto h-[38rem] max-w-7xl rounded-xl border border-border bg-card/60 motion-safe:animate-pulse" />
      </div>
    </div>
  )
}
