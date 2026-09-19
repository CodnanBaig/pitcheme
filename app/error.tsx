"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandMark } from "@/components/brand-mark"

type AppError = Error & { digest?: string }
const DIGEST_PATTERN = /^[A-Za-z0-9._:-]{1,96}$/

function safeDigest(value: unknown): string | undefined {
  return typeof value === "string" && DIGEST_PATTERN.test(value) ? value : undefined
}

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: AppError
  reset: () => void
}) {
  const digest = safeDigest(error.digest)

  useEffect(() => {
    // Keep the client log safe for production: the exception message may
    // contain user-provided content, so only expose the framework digest.
    console.error("Application error boundary triggered", {
      digest: digest || "unavailable",
    })
    if (process.env.NODE_ENV !== "production") return

    void fetch("/api/telemetry/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify(digest ? { digest } : {}),
    }).catch(() => undefined)
  }, [digest])

  const incidentId = digest?.slice(0, 12) || "unavailable"

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground sm:px-10">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <section
          aria-labelledby="application-error-title"
          className="w-full rounded-xl border border-border bg-card p-8 sm:p-12"
        >
          <BrandMark href="/" className="mb-8" />
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle aria-hidden="true" className="h-6 w-6" />
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Workspace system notice
          </p>
          <h1 id="application-error-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            We couldn&apos;t finish that request.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            The workspace is still safe. Retry the request, or return to the dashboard and continue from your last saved document.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={reset}>
              <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
              Try again
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">
                <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
                Return to dashboard
              </Link>
            </Button>
          </div>

          <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
            Incident reference: <span className="font-mono">{incidentId}</span>
          </p>
        </section>
      </div>
    </main>
  )
}
