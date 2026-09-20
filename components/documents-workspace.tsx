"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
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
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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

const documentDateFormatter = new Intl.DateTimeFormat("en", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

export function DocumentsWorkspace({ documents: initialDocuments, hasMore: initialHasMore = false, loadError = false }: DocumentsWorkspaceProps) {
  const router = useRouter()
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

  useEffect(() => {
    setDocuments(initialDocuments)
    setHasMore(initialHasMore)
    setNextPage(initialHasMore ? 2 : 1)
  }, [initialDocuments, initialHasMore])

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

  const hasActiveFilters = Boolean(query.trim() || typeFilter !== "all" || dateFilter !== "all" || sort !== "newest")

  function clearFilters() {
    setQuery("")
    setTypeFilter("all")
    setDateFilter("all")
    setSort("newest")
  }

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
    <>
      <PageHeading
        eyebrow="Document workspace"
        title="Documents"
        description="Find, review, and deliver every proposal and pitch deck from one controlled register."
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
        <Card role="alert" className="mb-6 border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">Document data is temporarily unavailable.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your saved documents are safe. Retry when the database connection recovers.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" className="shrink-0" onClick={() => router.refresh()}>
              Retry documents
            </Button>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="saved-documents-heading" className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/30 px-4 py-4 sm:px-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_auto_auto_auto] lg:items-end">
            <label className="grid gap-1.5" htmlFor="document-search">
              <span className="text-xs font-medium text-muted-foreground">Search documents</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input id="document-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title or client" className="h-10 bg-card pl-10" disabled={loadError} />
              </div>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Type
              <span className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true" />
                <select aria-label="Filter by type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-10 min-w-40 rounded-md border border-input bg-card pl-9 pr-8 text-sm font-normal text-foreground" disabled={loadError}>
                  <option value="all">All types</option>
                  <option value="proposal">Proposals</option>
                  <option value="pitch-deck">Pitch decks</option>
                </select>
              </span>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Date range
              <span className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true" />
                <select aria-label="Filter by date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="h-10 min-w-40 rounded-md border border-input bg-card pl-9 pr-8 text-sm font-normal text-foreground" disabled={loadError}>
                  <option value="all">Any date</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              </span>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Sort
              <select aria-label="Sort documents" value={sort} onChange={(event) => setSort(event.target.value as "newest" | "oldest")} className="h-10 min-w-36 rounded-md border border-input bg-card px-3 text-sm font-normal text-foreground" disabled={loadError}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
            </label>
          </div>
        </div>

        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5" aria-live="polite">
          <div className="flex items-center gap-3">
            <h2 id="saved-documents-heading" className="font-semibold text-foreground">Saved documents</h2>
            <Badge variant="secondary">{loadError ? "Unavailable" : `${filteredDocuments.length} of ${documents.length}`}</Badge>
          </div>
          <div className="flex items-center gap-3">
            {message && <span className="text-sm font-medium text-primary">{message}</span>}
            {hasActiveFilters && <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Reset filters</Button>}
          </div>
        </div>

        {loadError ? (
          <div className="px-5 py-16 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <h3 className="mt-4 font-semibold text-foreground">Documents unavailable</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Retry when the database connection recovers.</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted/40">
              <FileText className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-semibold text-foreground">{hasActiveFilters ? "No documents match these filters" : "Your document register is ready"}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {hasActiveFilters ? "Reset the filters or try a broader search." : "Create a proposal or pitch deck and it will appear here with its client, type, and delivery actions."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {hasActiveFilters ? (
                <Button type="button" variant="outline" onClick={clearFilters}>Reset filters</Button>
              ) : (
                <>
                  <Button variant="outline" asChild><Link href="/generate/proposal">Create proposal</Link></Button>
                  <Button asChild><Link href="/generate/pitch-deck">Create pitch deck</Link></Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="hidden grid-cols-[minmax(0,1fr)_8rem_9rem_8.5rem] gap-4 border-b border-border bg-muted/15 px-5 py-2.5 text-xs font-medium text-muted-foreground md:grid">
              <span>Document</span>
              <span>Type</span>
              <span>Created</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-border">
              {filteredDocuments.map((document) => (
                <article key={document.id} className="grid gap-4 px-4 py-4 transition-colors hover:bg-muted/25 sm:px-5 md:grid-cols-[minmax(0,1fr)_8rem_9rem_8.5rem] md:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                      {document.type === "proposal" ? <FileText className="h-5 w-5" aria-hidden="true" /> : <PresentationChart className="h-5 w-5" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0">
                      <Link href={detailPath(document)} className="block truncate font-medium text-foreground hover:text-primary hover:underline hover:underline-offset-4">
                        {document.projectTitle || document.clientName || "Untitled document"}
                      </Link>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{document.clientName || "No client assigned"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 md:block">
                    <span className="text-xs font-medium text-muted-foreground md:hidden">Type</span>
                    <Badge variant="outline" className="capitalize">{document.type.replace("-", " ")}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground md:block">
                    <span className="text-xs font-medium md:hidden">Created</span>
                    <time dateTime={document.createdAt}>{documentDateFormatter.format(new Date(document.createdAt))}</time>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-10 w-10" asChild>
                      <Link href={detailPath(document)} aria-label={`View ${document.projectTitle || "document"}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10" asChild>
                      <a href={exportPath(document)} aria-label={`Download ${document.projectTitle || "document"}`}><Download className="h-4 w-4" /></a>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="More document actions"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><Link href={`/documents/${document.id}/edit`}>Edit</Link></DropdownMenuItem>
                        <DropdownMenuItem disabled={pendingId === document.id} onSelect={() => void duplicateDocument(document)}>Duplicate</DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" disabled={pendingId === document.id} onSelect={() => void deleteDocument(document)}><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </article>
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center border-t border-border px-5 py-4">
                <Button variant="outline" onClick={() => void loadMoreDocuments()} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load more documents"}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  )
}
