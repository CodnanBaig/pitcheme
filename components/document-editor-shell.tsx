"use client"

import dynamic from "next/dynamic"
import type { EditableDocument } from "@/components/document-editor"

const DocumentEditor = dynamic(
  () => import("@/components/document-editor").then((module) => module.DocumentEditor),
  {
    ssr: false,
    loading: () => (
      <div aria-busy="true" aria-label="Loading document editor">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="space-y-3">
            <div className="h-4 w-28 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-9 w-72 max-w-full rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-4 w-96 max-w-full rounded bg-muted/80 motion-safe:animate-pulse" />
          </div>
          <div className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="h-5 w-40 rounded bg-muted motion-safe:animate-pulse" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-11 rounded-md bg-muted motion-safe:animate-pulse" />
              <div className="h-11 rounded-md bg-muted motion-safe:animate-pulse" />
            </div>
            <div className="h-72 rounded-md bg-muted motion-safe:animate-pulse" />
            <div className="h-11 w-32 rounded-md bg-muted motion-safe:animate-pulse" />
          </div>
        </div>
      </div>
    ),
  },
)

export function DocumentEditorShell({ document }: { document: EditableDocument }) {
  return <DocumentEditor document={document} />
}
