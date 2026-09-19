import Link from "next/link"
import { ArrowLeft, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandMark } from "@/components/brand-mark"

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground sm:px-10">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <section
          aria-labelledby="not-found-title"
          className="w-full rounded-xl border border-border bg-card p-8 sm:p-12"
        >
          <BrandMark href="/" className="mb-8" />
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <SearchX aria-hidden="true" className="h-6 w-6" />
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Workspace route unavailable</p>
          <h1 id="not-found-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            That workspace route is not available.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            The link may have expired, moved, or never existed. Return to the workspace entry point and continue from a safe starting place.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/">
                <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
                Return home
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/auth/signin">Sign in</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}
