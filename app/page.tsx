import Link from "next/link"
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileText,
  History,
  Presentation,
  ShieldCheck,
} from "lucide-react"
import { PublicHeader } from "@/components/public-header"
import { SmartCTAButton } from "@/components/smart-cta-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { isStripeBillingEnabled, STRIPE_PLANS } from "@/lib/stripe"

export const dynamic = "force-dynamic"

const workflow = [
  { step: "01", title: "Capture the brief", detail: "A guided intake collects client, scope, commercial, and audience context." },
  { step: "02", title: "Build the first draft", detail: "Generate a structured proposal or investor narrative from the same reliable workflow." },
  { step: "03", title: "Review and deliver", detail: "Edit, restore versions, share a controlled link, or export a client-ready file." },
]

export default function LandingPage() {
  const billingEnabled = isStripeBillingEnabled()
  const paidPlanAvailability = billingEnabled
    ? "Available in the configured billing environment"
    : "Paid plan staged for the billing release"
  const currentYear = new Date().getFullYear()

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader homeAnchors />

      <section className="overflow-hidden bg-[#0d1b2a] text-white">
        <div className="container grid min-h-[690px] items-center gap-14 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
          <div className="max-w-2xl">
            <div className="mb-7 inline-flex items-center gap-2 border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-[#47b8b7]" />
              Business documents, built with control
            </div>
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl lg:text-[4rem]">
              Generate Winning Proposals &amp; Pitch Decks
              <span className="block text-[#72cfcb]">without losing the narrative.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-300">
              Turn a structured brief into credible client and investor documents, then review, version, share, and export from one governed workspace.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <SmartCTAButton size="lg" className="h-11 bg-[#0e7373] px-6 text-white hover:bg-[#0b6262]">
                Start Creating Free <ArrowRight className="h-4 w-4" />
              </SmartCTAButton>
              <Button asChild size="lg" variant="outline" className="h-11 border-white/25 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white">
                <Link href="#features">Explore the workflow</Link>
              </Button>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
              {["No credit card required", "Private document workspace", "PDF and DOCX export"].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#47b8b7]" /> {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative lg:pl-6">
            <div className="absolute -inset-12 enterprise-grid opacity-30" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-xl border border-white/15 bg-[#f4f6f8] shadow-[0_32px_80px_rgba(0,0,0,0.28)]">
              <div className="flex h-11 items-center justify-between border-b border-[#d7e0e7] bg-white px-4">
                <div className="flex items-center gap-2 text-[11px] font-medium text-[#667085]">
                  <span className="h-2 w-2 rounded-full bg-[#18a6a6]" />
                  PitchGenie Workspace
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0e7373]">Ready for review</span>
              </div>
              <div className="grid min-h-[410px] grid-cols-[112px_1fr] sm:grid-cols-[150px_1fr]">
                <div className="bg-[#132337] p-3 sm:p-4">
                  <div className="mb-7 flex items-end gap-1.5 px-2">
                    <span className="h-2 w-1.5 bg-slate-400" />
                    <span className="h-4 w-1.5 bg-[#47b8b7]" />
                    <span className="h-3 w-1.5 bg-white" />
                  </div>
                  {["Overview", "Documents", "New proposal", "Pitch deck"].map((item, index) => (
                    <div key={item} className={`mb-1 rounded-md px-2 py-2 text-[10px] sm:text-xs ${index === 1 ? "bg-[#0e7373] text-white" : "text-slate-400"}`}>
                      {item}
                    </div>
                  ))}
                </div>
                <div className="p-4 sm:p-7">
                  <div className="flex flex-col justify-between gap-4 border-b border-[#d7e0e7] pb-5 sm:flex-row sm:items-end">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0e7373]">Proposal workspace</p>
                      <p className="mt-2 text-xl font-semibold text-[#0d1b2a]">Q4 Systems Rollout</p>
                      <p className="mt-1 text-xs text-[#667085]">Northstar Operations · Updated today</p>
                    </div>
                    <span className="w-fit rounded-full bg-[#dceeed] px-2.5 py-1 text-[10px] font-semibold text-[#0b5e5e]">Draft complete</span>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_120px]">
                    <div className="rounded-lg border border-[#d7e0e7] bg-white p-4">
                      <p className="text-xs font-semibold text-[#0d1b2a]">Document outline</p>
                      <div className="mt-3 divide-y divide-[#e8edf1]">
                        {["Executive summary", "Delivery scope", "Commercial terms", "Next steps"].map((item, index) => (
                          <div key={item} className="flex items-center justify-between py-2.5 text-[11px] text-[#526170]">
                            <span>{String(index + 1).padStart(2, "0")} · {item}</span>
                            <Check className="h-3.5 w-3.5 text-[#0e7373]" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-lg border border-[#d7e0e7] bg-white p-3"><p className="text-[10px] text-[#667085]">Version</p><p className="mt-1 text-sm font-semibold text-[#0d1b2a]">04</p></div>
                      <div className="rounded-lg border border-[#d7e0e7] bg-white p-3"><p className="text-[10px] text-[#667085]">Format</p><p className="mt-1 text-sm font-semibold text-[#0d1b2a]">Proposal</p></div>
                      <div className="rounded-lg bg-[#0e7373] p-3 text-white"><p className="text-[10px] text-white">Next action</p><p className="mt-1 text-xs font-semibold">Review draft</p></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-white">
        <div className="container grid divide-y divide-border py-2 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { icon: ShieldCheck, title: "Private by default", detail: "Account-scoped documents and controlled share links" },
            { icon: History, title: "Version aware", detail: "Restore earlier revisions without losing current work" },
            { icon: Download, title: "Delivery ready", detail: "Export proposals and decks in practical formats" },
          ].map(({ icon: Icon, title, detail }) => (
            <div key={title} className="flex gap-3 px-3 py-5 sm:px-6">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div><p className="text-sm font-semibold text-foreground">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="py-20 lg:py-28">
        <div className="container grid gap-12 lg:grid-cols-[0.65fr_1.35fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Core capabilities</p>
            <h2 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">Two document workflows. One operating standard.</h2>
            <p className="mt-5 max-w-md leading-7 text-muted-foreground">Each workflow is purpose-built for its audience while sharing the same controlled path from intake to delivery.</p>
          </div>
          <div className="space-y-5">
            <div className="grid overflow-hidden rounded-xl border border-border bg-white md:grid-cols-[1fr_220px]">
              <div className="p-7 sm:p-9">
                <FileText className="h-7 w-7 text-primary" />
                <h3 className="mt-6 text-2xl font-semibold">Client proposals</h3>
                <p className="mt-3 max-w-xl leading-7 text-muted-foreground">Shape client context into a structured commercial document with scope, timing, pricing, and next steps that remain editable.</p>
                <Button asChild variant="link" className="mt-5 h-auto p-0"><Link href="/generate/proposal">Build a proposal <ArrowRight className="h-4 w-4" /></Link></Button>
              </div>
              <div className="border-t border-border bg-[#e8edf1] p-7 md:border-l md:border-t-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Included structure</p>
                <ul className="mt-5 space-y-3 text-sm text-foreground">
                  {["Executive summary", "Project scope", "Delivery plan", "Commercial terms"].map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-primary" />{item}</li>)}
                </ul>
              </div>
            </div>
            <div className="grid overflow-hidden rounded-xl border border-border bg-white md:grid-cols-[220px_1fr]">
              <div className="order-2 border-t border-border bg-[#132337] p-7 text-white md:order-1 md:border-r md:border-t-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Narrative arc</p>
                <ol className="mt-5 space-y-3 text-sm text-slate-200">
                  {["Problem", "Solution", "Market", "Funding case"].map((item, index) => <li key={item} className="flex gap-3"><span className="text-[#47b8b7]">0{index + 1}</span>{item}</li>)}
                </ol>
              </div>
              <div className="order-1 p-7 sm:p-9 md:order-2">
                <Presentation className="h-7 w-7 text-primary" />
                <h3 className="mt-6 text-2xl font-semibold">Investor pitch decks</h3>
                <p className="mt-3 max-w-xl leading-7 text-muted-foreground">Turn company, market, traction, and funding inputs into an investor narrative with structured slides and speaker notes.</p>
                <Button asChild variant="link" className="mt-5 h-auto p-0"><Link href="/generate/pitch-deck">Build a pitch deck <ArrowRight className="h-4 w-4" /></Link></Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="border-y border-border bg-white py-20 lg:py-24">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Working method</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">A clear path from context to decision-ready output.</h2>
          </div>
          <div className="mt-12 border-y border-border">
            {workflow.map((item) => (
              <div key={item.step} className="grid gap-3 border-b border-border py-7 last:border-b-0 sm:grid-cols-[80px_240px_1fr] sm:items-center">
                <span className="text-sm font-semibold text-primary">{item.step}</span>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 lg:py-28">
        <div className="container">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Plans and access</p>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Start focused. Scale when the workflow proves itself.</h2>
            </div>
            <Button asChild variant="outline"><Link href="/pricing">Compare plans <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
          <div className="mt-10 grid overflow-hidden rounded-xl border border-border bg-white lg:grid-cols-3 lg:divide-x lg:divide-border">
            {(["FREE", "PRO", "ENTERPRISE"] as const).map((key) => {
              const plan = STRIPE_PLANS[key]
              const featured = key === "PRO"
              return (
                <div key={key} className={`relative p-7 ${featured ? "bg-[#f1f8f7]" : ""}`}>
                  {featured && <Badge className="absolute right-6 top-6">Most selected</Badge>}
                  <p className="text-sm font-semibold">{plan.name}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{key === "FREE" ? "For validating the workflow" : key === "PRO" ? "For independent delivery teams" : "For scaled document operations"}</p>
                  {key !== "FREE" && <p className="mt-2 text-xs text-muted-foreground">{paidPlanAvailability}</p>}
                  <p className="mt-7 text-4xl font-semibold">${plan.price}<span className="text-sm font-normal text-muted-foreground">{plan.price > 0 ? " / month" : ""}</span></p>
                  <ul className="mt-7 space-y-3 text-sm text-muted-foreground">
                    {plan.features.slice(0, 4).map((feature) => <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{feature}</li>)}
                  </ul>
                  <Button asChild variant={featured ? "default" : "outline"} className="mt-8 w-full">
                    <Link href={key === "FREE" ? "/auth/signup" : "/pricing"}>{key === "FREE" ? "Get Started Free" : billingEnabled ? `Choose ${plan.name}` : "View staged plan"}</Link>
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#0d1b2a] py-16 text-white">
        <div className="container flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <div><p className="text-sm font-medium text-[#72cfcb]">Your next document can start with structure.</p><h2 className="mt-3 max-w-2xl text-3xl font-semibold">Bring the brief. Leave with a controlled, editable business document.</h2></div>
          <SmartCTAButton className="h-11 shrink-0 bg-[#0e7373] px-6 text-white hover:bg-[#0b6262]">Start Creating Free <ArrowRight className="h-4 w-4" /></SmartCTAButton>
        </div>
      </section>

      <footer className="border-t border-border bg-white">
        <div className="container flex flex-col justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>© {currentYear} PitchGenie. Structured business document workflows.</p>
          <div className="flex flex-wrap gap-5"><Link href="/pricing" className="hover:text-foreground">Pricing</Link><Link href="/auth/signin" className="hover:text-foreground">Sign in</Link><Link href="/auth/signup" className="hover:text-foreground">Create account</Link></div>
        </div>
      </footer>
    </div>
  )
}
