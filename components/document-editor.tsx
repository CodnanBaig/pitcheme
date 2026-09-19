"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, History, RotateCcw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { parsePitchDeckSlides, serializePitchDeckSlides, type EditablePitchSlide } from "@/lib/pitch-deck-editor"

export type EditableDocument = {
  id: string
  type: string
  clientName: string | null
  clientCompany: string | null
  projectTitle: string | null
  content: string
  revision: string
}

type DocumentVersion = {
  id: string
  version: number
  projectTitle: string | null
  createdAt: string
}

export function DocumentEditor({ document }: { document: EditableDocument }) {
  const [clientName, setClientName] = useState(document.clientName || "")
  const [clientCompany, setClientCompany] = useState(document.clientCompany || "")
  const [projectTitle, setProjectTitle] = useState(document.projectTitle || "")
  const [content, setContent] = useState(document.content)
  const [slides, setSlides] = useState<EditablePitchSlide[] | null>(null)
  const [revision, setRevision] = useState(document.revision)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const autosaveTimer = useRef<number | null>(null)
  const saveInFlight = useRef<Promise<void> | null>(null)
  const revisionRef = useRef(document.revision)
  const changeVersionRef = useRef(0)
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null)
  const returnPath = document.type === "proposal" ? `/proposal/${document.id}` : `/pitch-deck/${document.id}`

  const loadVersions = useCallback(async () => {
    try {
      const response = await fetch(`/api/documents/${document.id}/versions`)
      if (!response.ok) return
      const payload = await response.json()
      setVersions(payload.versions || [])
    } catch {
      // Version history is supplementary; keep editing available if it fails.
    }
  }, [document.id])

  useEffect(() => {
    void loadVersions()
  }, [loadVersions])

  useEffect(() => {
    if (document.type === "pitch-deck") {
      setSlides(parsePitchDeckSlides(document.content))
    }
  }, [document.content, document.type])

  const persistDocument = useCallback(async () => {
    while (saveInFlight.current) await saveInFlight.current

    const requestedChangeVersion = changeVersionRef.current
    const requestedRevision = revisionRef.current
    const request = (async () => {
      setStatus("saving")
      setError(null)

      try {
        const response = await fetch(`/api/documents/${document.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "If-Match": `"${requestedRevision}"` },
          body: JSON.stringify({
            clientName: clientName.trim() || null,
            clientCompany: clientCompany.trim() || null,
            projectTitle: projectTitle.trim() || null,
            content,
          }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Unable to save document")
        setStatus("saved")
        if (typeof payload.revision === "string") {
          revisionRef.current = payload.revision
          setRevision(payload.revision)
        }
        if (changeVersionRef.current === requestedChangeVersion) setDirty(false)
        void loadVersions()
      } catch (saveError) {
        setStatus("error")
        setError(saveError instanceof Error ? saveError.message : "Unable to save document")
      }
    })()
    saveInFlight.current = request
    try {
      await request
    } finally {
      if (saveInFlight.current === request) saveInFlight.current = null
    }
  }, [clientCompany, clientName, content, document.id, loadVersions, projectTitle])

  useEffect(() => {
    if (!dirty || content.trim().length === 0) return
    autosaveTimer.current = window.setTimeout(() => {
      void persistDocument()
    }, 1_500)
    return () => {
      if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current)
      autosaveTimer.current = null
    }
  }, [content, dirty, persistDocument])

  async function saveDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (autosaveTimer.current !== null) {
      window.clearTimeout(autosaveTimer.current)
      autosaveTimer.current = null
    }
    await persistDocument()
  }

  async function restoreVersion(version: DocumentVersion) {
    if (!window.confirm(`Restore version ${version.version}? Your current content will remain in history.`)) return
    setRestoringVersion(version.version)
    setError(null)
    try {
      const response = await fetch(`/api/documents/${document.id}/versions/${version.version}`, {
        method: "POST",
        headers: { "If-Match": `"${revision}"` },
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Unable to restore version")
      const restored = payload.document
      setClientName(restored.clientName || "")
      setClientCompany(restored.clientCompany || "")
      setProjectTitle(restored.projectTitle || "")
      setContent(restored.content)
      setSlides(document.type === "pitch-deck" ? parsePitchDeckSlides(restored.content) : null)
      if (typeof payload.revision === "string") {
        revisionRef.current = payload.revision
        setRevision(payload.revision)
      }
      setDirty(false)
      setStatus("saved")
      await loadVersions()
    } catch (restoreError) {
      setStatus("error")
      setError(restoreError instanceof Error ? restoreError.message : "Unable to restore version")
    } finally {
      setRestoringVersion(null)
    }
  }

  function updateSlide(index: number, update: Partial<EditablePitchSlide>) {
    if (!slides) return
    const nextSlides = slides.map((slide, slideIndex) => slideIndex === index ? { ...slide, ...update } : slide)
    setSlides(nextSlides)
    setContent(serializePitchDeckSlides(nextSlides))
    changeVersionRef.current += 1
    setDirty(true)
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <a href={returnPath} className="mb-4 inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to document
            </a>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Workspace / Edit</p>
            <h1 className="text-3xl font-bold text-foreground">Edit {document.type === "proposal" ? "proposal" : "pitch deck"}</h1>
            <p className="mt-2 text-muted-foreground">Make a controlled update, then save it to your private workspace.</p>
          </div>
          <div className="hidden rounded-md border border-border bg-card px-3 py-2 text-right text-xs text-muted-foreground sm:block">
            <div className="font-medium capitalize text-foreground">{document.type.replace("-", " ")}</div>
            <div>Autosave is enabled — changes save after a short pause</div>
          </div>
        </div>

        <form onSubmit={saveDocument} className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Document details</CardTitle>
              <CardDescription>These fields control how the document is identified in your workspace and exports.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="project-title">Title</Label>
                <Input id="project-title" value={projectTitle} onChange={(event) => { changeVersionRef.current += 1; setProjectTitle(event.target.value); setDirty(true) }} maxLength={500} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-name">Client / company</Label>
                <Input id="client-name" value={clientName} onChange={(event) => { changeVersionRef.current += 1; setClientName(event.target.value); setDirty(true) }} maxLength={500} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-company">Organization</Label>
                <Input id="client-company" value={clientCompany} onChange={(event) => { changeVersionRef.current += 1; setClientCompany(event.target.value); setDirty(true) }} maxLength={500} />
              </div>
            </CardContent>
          </Card>

          {slides && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle>Slides</CardTitle>
                <CardDescription>Edit the generated deck as structured slides. Changes continue to use the same sanitized enterprise renderer.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {slides.map((slide, index) => (
                  <div key={index} className="space-y-4 rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Slide {index + 1}</p>
                      <span className="text-xs text-muted-foreground">Structured edit</span>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`slide-${index}-title`}>Slide {index + 1} title</Label>
                      <Input id={`slide-${index}-title`} value={slide.title} maxLength={500} onChange={(event) => updateSlide(index, { title: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`slide-${index}-bullets`}>Slide {index + 1} key points</Label>
                      <Textarea id={`slide-${index}-bullets`} value={slide.bullets.join("\n")} maxLength={40_000} onChange={(event) => updateSlide(index, { bullets: event.target.value.split("\n").slice(0, 20) })} className="min-h-28" aria-describedby={`slide-${index}-bullets-help`} />
                      <p id={`slide-${index}-bullets-help`} className="text-xs text-muted-foreground">One point per line.</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`slide-${index}-visual`}>Slide {index + 1} visual direction</Label>
                        <Textarea id={`slide-${index}-visual`} value={slide.visualSuggestion} maxLength={20_000} onChange={(event) => updateSlide(index, { visualSuggestion: event.target.value })} className="min-h-28" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`slide-${index}-notes`}>Slide {index + 1} speaker notes</Label>
                        <Textarea id={`slide-${index}-notes`} value={slide.speakerNotes} maxLength={20_000} onChange={(event) => updateSlide(index, { speakerNotes: event.target.value })} className="min-h-28" />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>{slides ? "Rendered content" : "Content"}</CardTitle>
              <CardDescription>{slides ? "The sanitized HTML payload is generated from the structured fields above." : "Keep the generated structure intact where possible. Markdown and generated slide markup are supported."}</CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="document-content" className="sr-only">Document content</Label>
              <Textarea id="document-content" value={content} readOnly={Boolean(slides)} onChange={(event) => { changeVersionRef.current += 1; setContent(event.target.value); setDirty(true) }} className="min-h-[30rem] font-mono text-sm leading-6" aria-describedby="document-content-help" />
              <div id="document-content-help" className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{content.length.toLocaleString()} / 1,000,000 characters</span>
                <span>{slides ? "Generated from structured slides." : "Content is sanitized when rendered as HTML."}</span>
              </div>
            </CardContent>
          </Card>

          {versions.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />Version history</CardTitle>
                <CardDescription>Every saved edit is retained for this document and scoped to your account.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {versions.map((version) => (
                    <div key={version.id} className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">Version {version.version}</p>
                        <p className="text-xs text-muted-foreground">{version.projectTitle || "Untitled document"} · {new Date(version.createdAt).toLocaleString()}</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" disabled={restoringVersion !== null} onClick={() => void restoreVersion(version)}>
                        <RotateCcw className="mr-2 h-3.5 w-3.5" />
                        {restoringVersion === version.version ? "Restoring…" : "Restore"}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <Button type="button" variant="outline" asChild><a href={returnPath}>Cancel</a></Button>
            <div className="flex items-center justify-end gap-3">
              <span className={`text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">
                {status === "saving" && "Saving…"}
                {status === "saved" && (dirty ? "Saving soon…" : "Saved")}
                {status === "error" && error}
              </span>
              <Button type="submit" disabled={status === "saving" || content.trim().length === 0}>
                <Save className="mr-2 h-4 w-4" />
                {status === "saving" ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </main>
  )
}
