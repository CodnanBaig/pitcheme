import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { PitchDeckFormShell } from "@/components/generation-form-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PresentationIcon as PresentationChart, CheckCircle } from "lucide-react"
import { getUserSubscription } from "@/lib/subscription"
import { STRIPE_PLANS } from "@/lib/stripe"
import { WorkspaceShell } from "@/components/workspace-shell"
import { PageHeading } from "@/components/page-heading"

export default async function GeneratePitchDeckPage() {
  const session = await auth()

  if (!session) {
    redirect("/auth/signin")
  }

  const subscription = await getUserSubscription(session.user.id)
  const plan = STRIPE_PLANS[subscription?.plan || "FREE"] || STRIPE_PLANS.FREE

  return (
    <WorkspaceShell active="pitch-deck" planName={`${plan.name} plan`}>
          <PageHeading
            eyebrow="New investor document"
            title="Generate Pitch Deck"
            description="Capture company, market, traction, and funding context for a structured investor narrative."
          />

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Form */}
            <div className="lg:col-span-3">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>Startup Information</CardTitle>
                  <CardDescription>
                    Tell us about your startup and we'll create a compelling pitch deck for you
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PitchDeckFormShell />
                </CardContent>
              </Card>
            </div>

            {/* Info Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-lg">Slides Included</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Title & Company Overview</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Problem Statement</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Solution & Value Proposition</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Market Size & Opportunity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Business Model</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Traction & Milestones</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Team & Expertise</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Financial Projections</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Funding Ask & Use of Funds</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-accent">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PresentationChart className="w-5 h-5 text-primary" />
                    Investor narrative
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Our AI organizes your inputs into a clear investor narrative that you can review, edit, and export.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
    </WorkspaceShell>
  )
}
