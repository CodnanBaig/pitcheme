"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface ManageSubscriptionButtonProps {
  billingEnabled?: boolean
}

export function ManageSubscriptionButton({ billingEnabled = false }: ManageSubscriptionButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleManageSubscription = async () => {
    if (!billingEnabled || loading) return
    setError(null)
    setLoading(true)

    try {
      const response = await fetch("/api/stripe/create-portal", { method: "POST" })
      const body = await response.json().catch(() => ({})) as { url?: string; error?: string }
      if (response.status === 401) {
        router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`)
        return
      }
      if (!response.ok || !body.url) {
        throw new Error(body.error || "Unable to open the billing portal")
      }
      window.location.assign(body.url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open the billing portal")
    } finally {
      setLoading(false)
    }
  }

  return <div>
    <Button
      disabled={!billingEnabled || loading}
      variant="outline"
      className="w-full bg-transparent"
      onClick={handleManageSubscription}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {!billingEnabled ? "Billing staged" : "Manage subscription"}
    </Button>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </div>
}
