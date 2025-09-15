import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getUserSubscription, getUserUsage } from "@/lib/subscription"
import { STRIPE_PLANS } from "@/lib/stripe"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ManageSubscriptionButton } from "@/components/manage-subscription-button"

export default async function BillingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  const subscription = await getUserSubscription(session.user.id)
  const usage = await getUserUsage(session.user.id)
  const planKey = (subscription?.plan) || "FREE"
  const plan = STRIPE_PLANS[planKey]

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Billing & Usage</h1>
        <p className="text-gray-600 mt-2">Manage your subscription and view usage statistics</p>
      </div>

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
                <div key={index} className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3" />
                  {feature}
                </div>
              ))}
            </div>

            {planKey !== "FREE" && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm text-gray-600">
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
              <ManageSubscriptionButton />
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

            {planKey === "FREE" && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Upgrade to Pro for unlimited document generation and premium features.
                </p>
                <Button asChild className="mt-2 w-full" size="sm">
                  <a href="/pricing">Upgrade Now</a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
