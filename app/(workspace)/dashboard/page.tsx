import { auth } from "@/auth"
import type { Session } from "next-auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  PresentationIcon as PresentationChart,
  Plus,
  Clock,
  TrendingUp,
  CreditCard,
  Download,
  Eye,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getCachedUserSubscription, getUserUsage } from "@/lib/subscription"
import { isStripeBillingEnabled, STRIPE_PLANS } from "@/lib/stripe"
import { getServerRequestId, reportServerRouteError } from "@/lib/server-error-telemetry"
import { PageHeading } from "@/components/page-heading"

export const runtime = "nodejs"

export default async function DashboardPage() {
  const requestId = await getServerRequestId()
  const session = await auth()

  if (!session || !session.user?.id) {
    redirect("/auth/signin")
  }

  try {
    // Fetch real documents from database
    const recentDocuments = await prisma.document.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        type: true,
        clientName: true,
        projectTitle: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 3,
    })

    // Fetch subscription and usage data
    const subscription = await getCachedUserSubscription(session.user.id)
    const usage = await getUserUsage(session.user.id)

    // Calculate stats
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
    const totalDocuments = await prisma.document.count({
      where: {
        userId: session.user.id,
      },
    })

    const thisMonthDocuments = await prisma.document.count({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: new Date(`${currentMonth}-01`),
        },
      },
    })

    const stats = {
      totalDocuments,
      thisMonth: thisMonthDocuments,
      generationsThisMonth: usage.proposals + usage.pitchDecks,
    }

    return (
      <DashboardContent
        session={session}
        recentDocuments={recentDocuments}
        stats={stats}
        subscription={subscription}
      />
    )
  } catch (error) {
    reportServerRouteError({
      requestId,
      path: "/dashboard",
      category: "dashboard-data",
      error,
    })
    // Return dashboard with empty data on error
    return (
      <DashboardContent
        session={session}
        recentDocuments={[]}
        stats={null}
        subscription={null}
        loadError
      />
    )
  }
}

// Separate component to keep the JSX clean
type DashboardDocument = {
  id: string
  type: string
  clientName: string | null
  projectTitle: string | null
  createdAt: Date | string
}

type DashboardContentProps = {
  session: Session
  recentDocuments: DashboardDocument[]
  stats: { totalDocuments: number; thisMonth: number; generationsThisMonth: number } | null
  subscription: { plan?: string } | null
  loadError?: boolean
}

function DashboardContent({ session, recentDocuments, stats, subscription, loadError = false }: DashboardContentProps) {
  const plan = subscription
    ? STRIPE_PLANS[(subscription.plan as keyof typeof STRIPE_PLANS) || "FREE"] || STRIPE_PLANS.FREE
    : null
  const billingEnabled = isStripeBillingEnabled()

  return (
    <>
        <PageHeading
          eyebrow="Workspace overview"
          title={`Welcome back, ${session.user?.name?.split(" ")[0] || "there"}!`}
          description="Create, review, and deliver proposals and pitch decks from one controlled workspace."
        />

        {loadError && (
          <Card role="alert" className="mb-8 border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
                <div>
                  <p className="font-medium text-foreground">Workspace data is temporarily unavailable.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your saved documents are safe. Retry the dashboard once the database connection recovers.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="shrink-0">
                <a href="/dashboard">Retry dashboard</a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="mb-8 grid gap-5 md:grid-cols-2">
          <Card className="group border-border bg-card transition-colors hover:border-primary/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent transition-colors group-hover:bg-[#c8e4e2]">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <Plus className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <CardTitle className="text-xl">Generate Proposal</CardTitle>
              <CardDescription>
                Turn client context into a structured scope, delivery plan, and commercial proposal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/generate/proposal">Start New Proposal</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group border-border bg-card transition-colors hover:border-primary/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent transition-colors group-hover:bg-[#c8e4e2]">
                  <PresentationChart className="h-6 w-6 text-primary" />
                </div>
                <Plus className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <CardTitle className="text-xl">Generate Pitch Deck</CardTitle>
              <CardDescription>
                Shape company, market, traction, and funding context into an investor-ready narrative.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/generate/pitch-deck">Start New Pitch Deck</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Stats Cards */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-border bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Your Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Total Documents</span>
                  </div>
                  <span className="font-semibold text-foreground">{stats?.totalDocuments ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">This Month</span>
                  </div>
                  <span className="font-semibold text-foreground">{stats?.thisMonth ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Generations This Month</span>
                  </div>
                  <span className="font-semibold text-primary">{stats?.generationsThisMonth ?? "—"}</span>
                </div>
              </CardContent>
            </Card>

            {loadError ? (
              <Card className="border-border bg-muted/30">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                    Plan details unavailable
                  </CardTitle>
                  <CardDescription>Retry the dashboard to refresh your subscription and usage status.</CardDescription>
                </CardHeader>
              </Card>
            ) : plan?.name === "Free" && billingEnabled ? (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Upgrade to Pro
                  </CardTitle>
                  <CardDescription>Unlock unlimited documents and premium features</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full bg-primary hover:bg-primary/90">
                    <Link href="/pricing">Upgrade Now</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : plan?.name === "Free" ? (
              <Card className="border-border bg-muted/30">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                    Paid plans staged
                  </CardTitle>
                  <CardDescription>Billing is disabled in this deployment; your free workspace remains available.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/pricing">View plan details</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    {plan?.name || "Workspace"} workspace
                  </CardTitle>
                  <CardDescription>Your current plan is reflected in usage limits and account settings.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/billing">View billing & usage</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Documents */}
          <div className="lg:col-span-2">
            <Card className="border-border bg-card">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Recent Documents</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/documents">View All</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recentDocuments.length > 0 ? (
                  <div className="space-y-4">
                    {recentDocuments.map((doc: DashboardDocument) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            {doc.type === "proposal" ? (
                              <FileText className="w-5 h-5 text-primary" />
                            ) : (
                              <PresentationChart className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-medium text-foreground">{doc.projectTitle || doc.clientName || "Untitled Document"}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="default" className="text-xs capitalize">
                                {doc.type.replace("-", " ")}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(doc.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={doc.type === "proposal" ? `/proposal/${doc.id}` : `/pitch-deck/${doc.id}`} aria-label="View document">
                              <Eye className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <a href={`/api/export/${doc.type === "proposal" ? "proposal" : "pitch-deck"}/${doc.id}?format=pdf`} aria-label="Download document">
                              <Download className="w-4 h-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : loadError ? (
                  <div className="py-8 text-center">
                    <AlertCircle className="mx-auto mb-4 h-8 w-8 text-muted-foreground" aria-hidden="true" />
                    <h3 className="font-medium text-foreground mb-2">Recent documents unavailable</h3>
                    <p className="text-muted-foreground">Retry the dashboard after the database connection recovers.</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-foreground mb-2">No documents yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first proposal or pitch deck to get started
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button size="sm" asChild>
                        <Link href="/generate/proposal">Create Proposal</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/generate/pitch-deck">Create Pitch Deck</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
    </>
  )
}
