import { redirect } from "next/navigation"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getCachedUserSubscription, getUserUsage } from "@/lib/subscription"
import { isStripeBillingEnabled, STRIPE_PLANS } from "@/lib/stripe"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ManageSubscriptionButton } from "@/components/manage-subscription-button"
import { PageHeading } from "@/components/page-heading"

export const runtime = "nodejs"

export default async function BillingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  const subscription = await getCachedUserSubscription(session.user.id)
  const usage = await getUserUsage(session.user.id)
  const planKey = (subscription?.plan) || "FREE"
  const plan = STRIPE_PLANS[planKey]
  const billingEnabled = isStripeBillingEnabled()

  return (
    <>
      <PageHeading
        eyebrow="Account administration"
        title="Billing & Usage"
        description="Manage your subscription and review monthly document generation usage."
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Current Plan
              <Badge variant={planKey === "FREE" ? "secondary" : "default"}>{plan.name}</Badge>
            </CardTitle>
            <CardDescription>
              {planKey === "FREE" ? "You are on the free plan" : `$${plan.price}/month`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {plan.features.map((feature, index) => (
                <div key={index} className="flex items-center text-sm text-muted-foreground">
                  <div className="mr-3 h-2 w-2 rounded-full bg-primary" />
                  {feature}
                </div>
              ))}
            </div>

            {planKey !== "FREE" && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  <p>
                    Status: <span className="capitalize font-medium">{subscription?.status || "active"}</span>
                  </p>
                  {subscription?.currentPeriodEnd && (
                    <p>Next billing: {subscription.currentPeriodEnd.toLocaleDateString()}</p>
                  )}
                  {subscription?.cancelAtPeriodEnd && <p className="text-orange-600">Cancels at period end</p>}
                </div>
              </div>
            )}

            <div className="mt-6">
              <ManageSubscriptionButton billingEnabled={billingEnabled} />
            </div>
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Usage This Month</CardTitle>
            <CardDescription>Track your document generation usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Proposals Usage */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Proposals</span>
                <span>
                  {usage.proposals} / {plan.limits.proposals === -1 ? "∞" : plan.limits.proposals}
                </span>
              </div>
              <Progress
                value={plan.limits.proposals === -1 ? 0 : (usage.proposals / plan.limits.proposals) * 100}
                className="h-2"
              />
            </div>

            {/* Pitch Decks Usage */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Pitch Decks</span>
                <span>
                  {usage.pitchDecks} / {plan.limits.pitchDecks === -1 ? "∞" : plan.limits.pitchDecks}
                </span>
              </div>
              <Progress
                value={plan.limits.pitchDecks === -1 ? 0 : (usage.pitchDecks / plan.limits.pitchDecks) * 100}
                className="h-2"
              />
            </div>

            {planKey === "FREE" && billingEnabled ? (
              <div className="mt-4 rounded-lg border border-primary/20 bg-accent p-3">
                <p className="text-sm text-accent-foreground">
                  Upgrade to Pro for unlimited document generation and premium features.
                </p>
                <Button asChild className="mt-2 w-full" size="sm">
                    <Link href="/pricing">Upgrade Now</Link>
                </Button>
              </div>
            ) : planKey === "FREE" ? (
              <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm text-muted-foreground">
                  Paid billing is staged in this deployment. Your free plan limits remain active.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
