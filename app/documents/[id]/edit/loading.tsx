export default function Loading() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading document editor">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-3">
          <div className="h-4 w-28 rounded bg-muted motion-safe:animate-pulse" />
          <div className="h-9 w-72 max-w-full rounded bg-muted motion-safe:animate-pulse" />
          <div className="h-4 w-96 max-w-full rounded bg-muted/80 motion-safe:animate-pulse" />
        </div>
        <div className="h-[34rem] rounded-xl border border-border bg-card/60 motion-safe:animate-pulse" />
      </div>
    </main>
  )
}
