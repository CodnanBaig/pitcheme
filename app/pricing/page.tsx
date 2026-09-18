import Link from "next/link"
import { ArrowLeft, Check, Crown, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UpgradeButton } from "@/components/upgrade-button"
import { isStripeBillingEnabled, STRIPE_PLANS } from "@/lib/stripe"

export const dynamic = "force-dynamic"

const plans = [
  { key: "FREE" as const, label: "For trying the workflow", featured: false },
  { key: "PRO" as const, label: "For independent teams", featured: true },
  { key: "ENTERPRISE" as const, label: "For scaled delivery", featured: false },
]

export default function PricingPage() {
  const billingEnabled = isStripeBillingEnabled()
  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 flex items-start justify-between gap-6">
          <div>
            <Link href="/" className="mb-6 inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
            </Link>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Plans & access</p>
            <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">A clear path from first draft to repeatable delivery.</h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">Choose the workspace size that fits your process. {billingEnabled ? "Checkout is available in the configured Stripe environment." : "Paid checkout is staged until the deployment enables Stripe test mode."}</p>
          </div>
          <div className="hidden rounded-lg border border-border bg-card p-4 text-right sm:block">
            <Zap className="ml-auto h-5 w-5 text-primary" />
            <p className="mt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Enterprise direction</p>
            <p className="mt-1 text-sm font-semibold text-foreground">Controlled. Clear. Ready.</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map(({ key, label, featured }) => {
            const plan = STRIPE_PLANS[key]
            return (
              <Card key={key} className={`relative flex flex-col border-border bg-card ${featured ? "border-primary shadow-lg shadow-primary/10" : ""}`}>
                {featured && <Badge className="absolute right-5 top-5">Most selected</Badge>}
                <CardHeader>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    {key === "ENTERPRISE" ? <Crown className="h-5 w-5 text-primary" /> : <Zap className="h-5 w-5 text-primary" />}
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{label}</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                    {plan.price > 0 && <span className="text-muted-foreground"> / month</span>}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-8">
                    {key === "FREE" ? (
                      <Button asChild className="w-full"><Link href="/auth/signup">Start free</Link></Button>
                    ) : (
                      <UpgradeButton planType={key} billingEnabled={billingEnabled} className="w-full">
                        Choose {plan.name}
                      </UpgradeButton>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">{billingEnabled ? "Payments are processed by Stripe. Subscription access updates after a verified webhook." : "Paid plan checkout, webhooks, and portal actions remain disabled until the billing release is enabled."}</p>
      </div>
    </main>
  )
}
