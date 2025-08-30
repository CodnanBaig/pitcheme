import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  FileText,
  PresentationIcon as PresentationChart,
  Search,
  Filter,
  Download,
  Eye,
  MoreHorizontal,
  Zap,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { prisma } from "@/lib/prisma"

export default async function DocumentsPage() {
  const session = await auth()

  if (!session) {
    redirect("/auth/signin")
  }

  try {
    // Fetch real documents from database
    const documents = await prisma.document.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return (
      <DocumentsContent session={session} documents={documents} />
    )
  } catch (error) {
    console.error("Error loading documents:", error)
    // Return page with empty documents on error
    return (
      <DocumentsContent session={session} documents={[]} />
    )
  }
}

// Separate component to keep the JSX clean
function DocumentsContent({ session, documents }: any) {
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
              <Link href="/documents" className="text-foreground font-medium">
                Documents
              </Link>
              <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
                Settings
              </Link>
            </nav>
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="hidden sm:flex">
                Free Plan
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
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Documents</h1>
            <p className="text-muted-foreground">Manage all your proposals and pitch decks in one place</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/generate/proposal">
                <FileText className="w-4 h-4 mr-2" />
                New Proposal
              </Link>
            </Button>
            <Button asChild>
              <Link href="/generate/pitch-deck">
                <PresentationChart className="w-4 h-4 mr-2" />
                New Pitch Deck
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="border-border bg-card mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search documents..." className="pl-10" />
              </div>
              <Button variant="outline" className="sm:w-auto bg-transparent">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>All Documents ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      {doc.type === "proposal" ? (
                        <FileText className="w-6 h-6 text-primary" />
                      ) : (
                        <PresentationChart className="w-6 h-6 text-accent" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground mb-1">{doc.projectTitle || doc.clientName || "Untitled Document"}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Client: {doc.clientName || "N/A"}</span>
                        <span>•</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                        <Badge variant="default" className="text-xs capitalize">
                          {doc.type.replace("-", " ")}
                        </Badge>
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Duplicate</DropdownMenuItem>
                        <DropdownMenuItem>Share</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
