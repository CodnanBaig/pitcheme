import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { User, CreditCard, Bell, Shield, Zap, Crown } from "lucide-react"
import Link from "next/link"
import { ProfileSettingsForm } from "@/components/profile-settings-form"
import { getUserSubscription, getUserUsage } from "@/lib/subscription"
import { STRIPE_PLANS } from "@/lib/stripe"
import { AuthButton } from "@/components/auth-button"
import { MobileNav } from "@/components/mobile-nav"

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">PitchGenie</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <Link href="/documents" className="text-muted-foreground hover:text-foreground transition-colors">
                Documents
              </Link>
              <Link href="/settings" className="text-foreground font-medium">
                Settings
              </Link>
            </nav>
            <div className="flex items-center gap-2 sm:gap-4">
              <Badge variant="secondary" className="hidden sm:flex">
                {plan.name}
              </Badge>
              <MobileNav
                items={[
                  { href: "/dashboard", label: "Dashboard" },
                  { href: "/documents", label: "Documents" },
                  { href: "/settings", label: "Settings" },
                ]}
              />
              <AuthButton />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>

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
      </div>
    </div>
  )
}
