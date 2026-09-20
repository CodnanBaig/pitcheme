import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { User, CreditCard, Bell, Shield, Crown } from "lucide-react"
import Link from "next/link"
import { ProfileSettingsForm } from "@/components/profile-settings-form"
import { getUserSubscription, getUserUsage } from "@/lib/subscription"
import { STRIPE_PLANS } from "@/lib/stripe"
import { PageHeading } from "@/components/page-heading"

export const runtime = "nodejs"

export default async function SettingsPage() {
  const session = await auth()

  if (!session) {
    redirect("/auth/signin")
  }

  const [subscription, usage] = await Promise.all([
    getUserSubscription(session.user.id),
    getUserUsage(session.user.id),
  ])
  const planKey = subscription?.plan || "FREE"
  const plan = STRIPE_PLANS[planKey] || STRIPE_PLANS.FREE

  return (
    <>
        <PageHeading
          eyebrow="Account administration"
          title="Settings"
          description="Manage your profile, subscription, and workspace preferences."
        />

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Settings Navigation */}
          <div className="lg:col-span-1">
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <nav className="space-y-2">
                  <Button variant="ghost" className="w-full justify-start bg-muted">
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </Button>
                  <Button variant="ghost" className="w-full justify-start" asChild>
                    <Link href="/billing">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Billing
                    </Link>
                  </Button>
                  <div className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground">
                    <Bell className="w-4 h-4 mr-2" />
                    <span className="mr-auto">Notifications</span>
                    <Badge variant="outline" className="text-[10px]">Planned</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground">
                    <Shield className="w-4 h-4 mr-2" />
                    <span className="mr-auto">Security</span>
                    <Badge variant="outline" className="text-[10px]">Planned</Badge>
                  </div>
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Profile Settings */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information and profile settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProfileSettingsForm initialName={session.user?.name || ""} email={session.user?.email || ""} />
              </CardContent>
            </Card>

            {/* Subscription */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-primary" />
                  Subscription
                </CardTitle>
                <CardDescription>Manage your subscription and billing information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 border border-border rounded-lg mb-4">
                  <div>
                    <h3 className="font-medium text-foreground">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {plan.limits.proposals === -1 ? "Unlimited proposals" : `${plan.limits.proposals} proposals`} and {plan.limits.pitchDecks === -1 ? "unlimited pitch decks" : `${plan.limits.pitchDecks} pitch decks`} per month
                    </p>
                  </div>
                  <Badge variant={planKey === "FREE" ? "secondary" : "default"}>Current Plan</Badge>
                </div>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <p>Usage this month:</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between">
                        <span>Proposals</span>
                        <span>{usage.proposals} / {plan.limits.proposals === -1 ? "∞" : plan.limits.proposals}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pitch Decks</span>
                        <span>{usage.pitchDecks} / {plan.limits.pitchDecks === -1 ? "∞" : plan.limits.pitchDecks}</span>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <Button asChild>
                    <Link href="/pricing">
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade to Pro
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preferences */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>Customize your PitchGenie experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive updates about your documents and account</p>
                  </div>
                  <Badge variant="outline">Planned</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Default Template</Label>
                    <p className="text-sm text-muted-foreground">Choose your preferred document template</p>
                  </div>
                  <Badge variant="outline">Planned</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
    </>
  )
}
