"use client"

import { useState } from "react"
import { Link2, Link2Off, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

type ShareButtonProps = {
  documentId: string
  size?: "sm" | "default" | "lg"
  allowRevoke?: boolean
}

export function ShareButton({ documentId, size = "sm", allowRevoke = false }: ShareButtonProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const { toast } = useToast()

  async function createShareLink() {
    setIsCreating(true)
    try {
      const response = await fetch(`/api/documents/${documentId}/share`, { method: "POST", credentials: "include" })
      const payload = await response.json()
      if (!response.ok || typeof payload.sharePath !== "string") {
        throw new Error(payload.error || "Unable to create share link")
      }

      const shareUrl = new URL(payload.sharePath, window.location.origin).toString()
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        toast({ title: "Share link copied", description: "The read-only link expires in 7 days." })
      } else {
        toast({ title: "Share link ready", description: shareUrl })
      }
    } catch (error) {
      toast({
        title: "Unable to create share link",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  async function revokeShareLinks() {
    if (!window.confirm("Revoke all active share links for this document?")) return
    setIsRevoking(true)
    try {
      const response = await fetch(`/api/documents/${documentId}/share`, { method: "DELETE", credentials: "include" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Unable to revoke share links")
      toast({
        title: "Share links revoked",
        description: payload.revokedCount > 0 ? `${payload.revokedCount} active link${payload.revokedCount === 1 ? "" : "s"} disabled.` : "There were no active links to revoke.",
      })
    } catch (error) {
      toast({
        title: "Unable to revoke share links",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsRevoking(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size={size} onClick={() => void createShareLink()} disabled={isCreating || isRevoking}>
        {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
        {isCreating ? "Creating…" : "Share"}
      </Button>
      {allowRevoke && (
        <Button type="button" variant="ghost" size={size} onClick={() => void revokeShareLinks()} disabled={isCreating || isRevoking}>
          {isRevoking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2Off className="mr-2 h-4 w-4" />}
          {isRevoking ? "Revoking…" : "Revoke links"}
        </Button>
      )}
    </div>
  )
}
