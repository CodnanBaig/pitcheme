import { auth } from "@/auth"
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
  Zap,
  Download,
  Eye,
} from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getUserSubscription, getUserUsage } from "@/lib/subscription"

export default async function DashboardPage() {
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
      orderBy: {
        createdAt: "desc",
      },
      take: 3,
    })

    // Fetch subscription and usage data
    const subscription = await getUserSubscription(session.user.id)
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
      successRate: 85, // This could be calculated based on actual usage patterns
    }

    return (
      <DashboardContent
        session={session}
        recentDocuments={recentDocuments}
        stats={stats}
        subscription={subscription}
        usage={usage}
      />
    )
  } catch (error) {
    console.error("Error loading dashboard:", error)
    // Return dashboard with empty data on error
    return (
      <DashboardContent
        session={session}
        recentDocuments={[]}
        stats={{ totalDocuments: 0, thisMonth: 0, successRate: 0 }}
        subscription={null}
        usage={{ proposals: 0, pitchDecks: 0 }}
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
  session: any
  recentDocuments: DashboardDocument[]
  stats: { totalDocuments: number; thisMonth: number; successRate: number }
  subscription: { plan?: string } | null
  usage: { proposals: number; pitchDecks: number }
}

function DashboardContent({ session, recentDocuments, stats, subscription, usage }: DashboardContentProps) {
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
              <Link href="/dashboard" className="text-foreground font-medium">
                Dashboard
              </Link>
              <Link href="/documents" className="text-muted-foreground hover:text-foreground transition-colors">
                Documents
              </Link>
              <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
                Settings
              </Link>
            </nav>
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="hidden sm:flex">
                {subscription?.plan || "Free"} Plan
              </Badge>
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">
                  {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || "U"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back, {session.user?.name?.split(" ")[0] || "there"}!
          </h1>
          <p className="text-muted-foreground">Ready to create your next winning proposal or pitch deck?</p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="border-border bg-card hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <CardTitle className="text-xl">Generate Proposal</CardTitle>
              <CardDescription>
                Create a professional proposal with AI-powered content tailored to your client's needs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-primary hover:bg-primary/90">
                <Link href="/generate/proposal">Start New Proposal</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border bg-card hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <PresentationChart className="w-6 h-6 text-accent" />
                </div>
                <Plus className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
              <CardTitle className="text-xl">Generate Pitch Deck</CardTitle>
              <CardDescription>
                Build a compelling pitch deck that tells your startup's story and attracts investors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
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
                  <span className="font-semibold text-foreground">{stats.totalDocuments}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">This Month</span>
                  </div>
                  <span className="font-semibold text-foreground">{stats.thisMonth}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Success Rate</span>
                  </div>
                  <span className="font-semibold text-primary">{stats.successRate}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Upgrade Card */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
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
                              <PresentationChart className="w-5 h-5 text-accent" />
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
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
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
      </div>
    </div>
  )
}
