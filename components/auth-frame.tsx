import type { ReactNode } from "react"
import { Check } from "lucide-react"
import { BrandMark } from "@/components/brand-mark"

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-[#0d1b2a] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute inset-0 enterprise-grid opacity-10" aria-hidden="true" />
        <BrandMark href="/" inverse className="relative" />
        <div className="relative max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#72cfcb]">Enterprise document workspace</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.035em] xl:text-5xl">From business context to delivery-ready documents.</h1>
          <p className="mt-5 max-w-md leading-7 text-slate-300">A controlled workspace for creating, reviewing, versioning, and delivering proposals and investor decks.</p>
          <ul className="mt-8 space-y-3 text-sm text-slate-200">
            {["Structured proposal and pitch-deck workflows", "Private, account-scoped document history", "Editable drafts with controlled exports"].map((item) => (
              <li key={item} className="flex items-center gap-3"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#18a6a6]/20"><Check className="h-3.5 w-3.5 text-[#72cfcb]" /></span>{item}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">PitchGenie · Structured business document workflows</p>
      </aside>
      <main className="flex min-h-screen items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-7 lg:hidden"><BrandMark href="/" /></div>
          {children}
        </div>
      </main>
    </div>
  )
}
