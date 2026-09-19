import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { ProposalFormShell } from "@/components/generation-form-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, CheckCircle } from "lucide-react"
import { getUserSubscription } from "@/lib/subscription"
import { STRIPE_PLANS } from "@/lib/stripe"
import { WorkspaceShell } from "@/components/workspace-shell"
import { PageHeading } from "@/components/page-heading"

export default async function GenerateProposalPage() {
  const session = await auth()

  if (!session) {
    redirect("/auth/signin")
  }

  const subscription = await getUserSubscription(session.user.id)
  const plan = STRIPE_PLANS[subscription?.plan || "FREE"] || STRIPE_PLANS.FREE

  return (
    <WorkspaceShell active="proposal" planName={`${plan.name} plan`}>
          <PageHeading
            eyebrow="New business document"
            title="Generate Proposal"
            description="Capture the client, scope, timing, and commercial context needed for a structured first draft."
          />

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Form */}
            <div className="lg:col-span-3">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>Proposal Details</CardTitle>
                  <CardDescription>
                    Fill in the information below and we'll generate a professional proposal for you
                  </CardDescription>
                </CardHeader>
                <CardContent>
                <ProposalFormShell />
                </CardContent>
              </Card>
            </div>

            {/* Info Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-lg">What's Included</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Professional cover page</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Executive summary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Detailed project scope</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Timeline & milestones</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Pricing breakdown</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Call-to-action</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-accent">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Structured generation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Your inputs are organized into a complete first draft that remains editable before delivery.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
    </WorkspaceShell>
  )
}
