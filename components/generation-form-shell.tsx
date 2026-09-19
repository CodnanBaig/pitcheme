"use client"

import dynamic from "next/dynamic"

function FormLoadingState({ accent }: { accent: "primary" | "accent" }) {
  const accentClass = accent === "primary" ? "bg-primary/15" : "bg-accent/15"

  return (
    <div
      className="min-h-[32rem] space-y-8"
      aria-busy="true"
      aria-label="Loading generation form"
    >
      <div className="flex items-center justify-center gap-4">
        <div className={`h-8 w-32 rounded-full motion-safe:animate-pulse ${accentClass}`} />
        <div className="h-px w-10 bg-border" />
        <div className="h-8 w-32 rounded-full bg-muted motion-safe:animate-pulse" />
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="h-5 w-48 rounded bg-muted motion-safe:animate-pulse" />
        <div className="h-4 w-72 max-w-full rounded bg-muted/80 motion-safe:animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-11 rounded-md bg-muted motion-safe:animate-pulse" />
          <div className="h-11 rounded-md bg-muted motion-safe:animate-pulse" />
        </div>
        <div className="h-28 rounded-md bg-muted motion-safe:animate-pulse" />
        <div className="h-11 w-40 rounded-md bg-muted motion-safe:animate-pulse" />
      </div>
    </div>
  )
}

const ProposalForm = dynamic(
  () => import("@/components/enhanced-proposal-form").then((module) => module.EnhancedProposalForm),
  { ssr: false, loading: () => <FormLoadingState accent="primary" /> },
)

const PitchDeckForm = dynamic(
  () => import("@/components/enhanced-pitch-deck-form").then((module) => module.EnhancedPitchDeckForm),
  { ssr: false, loading: () => <FormLoadingState accent="accent" /> },
)

export function ProposalFormShell() {
  return <ProposalForm />
}

export function PitchDeckFormShell() {
  return <PitchDeckForm />
}
