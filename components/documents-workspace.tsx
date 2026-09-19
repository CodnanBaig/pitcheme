"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Download,
  Eye,
  FileText,
  Filter,
  MoreHorizontal,
  PresentationIcon as PresentationChart,
  Search,
  Trash2,
  AlertCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { WorkspaceShell } from "@/components/workspace-shell"
import { PageHeading } from "@/components/page-heading"

export type DocumentListItem = {
  id: string
  type: string
  clientName: string | null
  projectTitle: string | null
  createdAt: string
}

type DocumentsWorkspaceProps = {
  documents: DocumentListItem[]
  user: { name?: string | null; email?: string | null }
  hasMore?: boolean
  planName?: string
  loadError?: boolean
}

function detailPath(document: DocumentListItem) {
  return document.type === "proposal" ? `/proposal/${document.id}` : `/pitch-deck/${document.id}`
}

function exportPath(document: DocumentListItem) {
  return `/api/export/${document.type === "proposal" ? "proposal" : "pitch-deck"}/${document.id}?format=pdf`
}

function normalizeDocument(value: DocumentListItem & { createdAt: string | Date }): DocumentListItem {
  return {
    ...value,
    createdAt: new Date(value.createdAt).toISOString(),
  }
}

export function DocumentsWorkspace({ documents: initialDocuments, hasMore: initialHasMore = false, planName = "Free", loadError = false }: DocumentsWorkspaceProps) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [nextPage, setNextPage] = useState(initialHasMore ? 2 : 1)
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [sort, setSort] = useState<"newest" | "oldest">("newest")
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  async function loadMoreDocuments() {
    setLoadingMore(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/documents?limit=100&page=${nextPage}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Unable to load more documents")
      setDocuments((current) => [...current, ...payload.documents.map(normalizeDocument)])
      setHasMore(Boolean(payload.hasMore))
      setNextPage((current) => current + 1)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load more documents")
    } finally {
      setLoadingMore(false)
    }
  }

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return documents
      .filter((document) => typeFilter === "all" || document.type === typeFilter)
      .filter((document) => {
        if (dateFilter === "all") return true
        const days = Number(dateFilter)
        return Date.now() - new Date(document.createdAt).getTime() <= days * 24 * 60 * 60 * 1000
      })
      .filter((document) => {
        if (!normalizedQuery) return true
        return [document.projectTitle, document.clientName]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery))
      })
      .sort((left, right) => {
        const difference = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        return sort === "newest" ? -difference : difference
      })
  }, [dateFilter, documents, query, sort, typeFilter])

  async function duplicateDocument(document: DocumentListItem) {
    setPendingId(document.id)
    setMessage(null)
    try {
      const response = await fetch(`/api/documents/${document.id}/duplicate`, { method: "POST" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Unable to duplicate document")
      setDocuments((current) => [normalizeDocument(payload.document), ...current])
      setMessage("Document duplicated")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to duplicate document")
    } finally {
      setPendingId(null)
    }
  }

  async function deleteDocument(document: DocumentListItem) {
    if (!window.confirm(`Delete “${document.projectTitle || document.clientName || "Untitled document"}”?`)) return
    setPendingId(document.id)
    setMessage(null)
    try {
      const response = await fetch(`/api/documents/${document.id}`, { method: "DELETE" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Unable to delete document")
      setDocuments((current) => current.filter((item) => item.id !== document.id))
      setMessage("Document deleted")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete document")
    } finally {
      setPendingId(null)
    }
  }

  return (
    <WorkspaceShell active="documents" planName={loadError ? "Plan unavailable" : `${planName} plan`}>
        <PageHeading
          eyebrow="Document workspace"
          title="Documents"
          description="Manage proposals and pitch decks with clear ownership, version history, and delivery actions."
          actions={
            <>
            <Button variant="outline" asChild>
              <Link href="/generate/proposal"><FileText className="mr-2 h-4 w-4" />New Proposal</Link>
            </Button>
            <Button asChild>
              <Link href="/generate/pitch-deck"><PresentationChart className="mr-2 h-4 w-4" />New Pitch Deck</Link>
            </Button>
            </>
          }
        />

        {loadError && (
          <Card role="alert" className="mb-6 border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
                <div>
                  <p className="font-medium text-foreground">Document data is temporarily unavailable.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your saved documents are safe. Retry the workspace once the database connection recovers.
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" className="shrink-0" onClick={() => window.location.reload()}>
                Retry documents
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 border-border bg-card">
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-[1fr_auto_auto_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <label htmlFor="document-search" className="sr-only">Search documents</label>
                <Input id="document-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents..." className="pl-10" disabled={loadError} />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span className="sr-only">Filter by type</span>
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground" disabled={loadError}>
                  <option value="all">All types</option>
                  <option value="proposal">Proposals</option>
                  <option value="pitch-deck">Pitch decks</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="sr-only">Sort documents</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as "newest" | "oldest")} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground" disabled={loadError}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="sr-only">Filter by date</span>
                <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground" disabled={loadError}>
                  <option value="all">All dates</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              </label>
            </div>
            <div className="mt-3 flex min-h-5 items-center justify-between text-sm" aria-live="polite">
              <span className="text-muted-foreground">{loadError ? "Document data unavailable" : `${filteredDocuments.length} of ${documents.length} documents`}</span>
              {message && <span className="text-primary">{message}</span>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader><CardTitle>All Documents ({filteredDocuments.length})</CardTitle></CardHeader>
          <CardContent>
            {loadError ? (
              <div className="py-12 text-center">
                <AlertCircle className="mx-auto mb-4 h-10 w-10 text-muted-foreground" aria-hidden="true" />
                <h2 className="font-medium text-foreground">Documents unavailable</h2>
                <p className="mt-1 text-sm text-muted-foreground">Retry the workspace after the database connection recovers.</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                <h2 className="font-medium text-foreground">No matching documents</h2>
                <p className="mt-1 text-sm text-muted-foreground">Adjust your search or create a new document.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDocuments.map((document) => (
                  <div key={document.id} className="flex flex-col gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        {document.type === "proposal" ? <FileText className="h-6 w-6 text-primary" /> : <PresentationChart className="h-6 w-6 text-primary" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-medium text-foreground">{document.projectTitle || document.clientName || "Untitled Document"}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{document.clientName || "No client"}</span>
                          <span aria-hidden="true">•</span>
                          <span>{new Date(document.createdAt).toLocaleDateString()}</span>
                          <Badge variant="default" className="text-xs capitalize">{document.type.replace("-", " ")}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={detailPath(document)} aria-label={`View ${document.projectTitle || "document"}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                      <a className={cn(buttonVariants({ variant: "ghost", size: "sm" }))} href={exportPath(document)} aria-label={`Download ${document.projectTitle || "document"}`}>
                        <Download className="h-4 w-4" />
                      </a>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" aria-label="More document actions"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild><Link href={`/documents/${document.id}/edit`}>Edit</Link></DropdownMenuItem>
                          <DropdownMenuItem disabled={pendingId === document.id} onSelect={() => void duplicateDocument(document)}>Duplicate</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" disabled={pendingId === document.id} onSelect={() => void deleteDocument(document)}><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
                {hasMore && (
                  <div className="flex justify-center pt-2">
                    <Button variant="outline" onClick={() => void loadMoreDocuments()} disabled={loadingMore}>
                      {loadingMore ? "Loading…" : "Load more documents"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
    </WorkspaceShell>
  )
}
