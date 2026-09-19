"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

type GenerationProgressProps = {
  documentType: "proposal" | "pitch-deck"
  accent: "primary" | "accent"
  activeStage?: number
}

const stages = [
  { label: "Brief ready", detail: "Preparing your requirements" },
  { label: "Drafting content", detail: "Building the core narrative" },
  { label: "Validating output", detail: "Checking structure and quality" },
  { label: "Saving document", detail: "Finishing your workspace copy" },
] as const

export function GenerationProgress({ documentType, accent, activeStage: controlledStage }: GenerationProgressProps) {
  const [timedStage, setTimedStage] = useState(0)
  const theme = accent === "accent"
    ? { text: "text-accent", background: "bg-accent", tint: "bg-accent/10" }
    : { text: "text-primary", background: "bg-primary", tint: "bg-primary/10" }
  const noun = documentType === "pitch-deck" ? "pitch deck" : "proposal"

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimedStage((current) => Math.min(current + 1, stages.length - 1))
    }, 4_000)

    return () => window.clearInterval(timer)
  }, [])

  const activeStage = Math.max(0, Math.min(controlledStage ?? timedStage, stages.length - 1))

  return (
    <section
      className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-card p-6 text-left shadow-sm sm:p-8"
      aria-label={`Generating ${noun}`}
      aria-live="polite"
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${theme.tint}`}>
          <Loader2 className={`h-6 w-6 ${theme.text} animate-spin`} aria-hidden="true" />
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme.text}`}>In progress</p>
          <h3 className="mt-1 text-xl font-semibold text-foreground">Creating your {noun}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Live stages update while the server validates and saves your document.
          </p>
        </div>
      </div>

      <div className="mt-7 space-y-4" role="list" aria-label="Generation stages">
        {stages.map((stage, index) => {
          const complete = index < activeStage
          const current = index === activeStage
          return (
            <div key={stage.label} className="flex items-start gap-3" role="listitem">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
                {complete ? (
                  <CheckCircle2 className={`h-5 w-5 ${theme.text}`} aria-hidden="true" />
                ) : current ? (
                  <span className={`h-3 w-3 rounded-full ${theme.background} ring-4 ${theme.tint}`} aria-hidden="true" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-border" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${current || complete ? "text-foreground" : "text-muted-foreground"}`}>
                  {stage.label}
                  {current ? <span className="sr-only"> (current)</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">{stage.detail}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
