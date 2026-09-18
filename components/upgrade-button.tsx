"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { STRIPE_PLANS, type PaidPlanType } from "@/lib/stripe-plans"

interface UpgradeButtonProps {
  planType: PaidPlanType
  className?: string
  children?: React.ReactNode
  billingEnabled?: boolean
}

export function UpgradeButton({ planType, className, children, billingEnabled = false }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const plan = STRIPE_PLANS[planType]

  const handleUpgrade = async () => {
    if (!billingEnabled || loading) return
    setError(null)
    setLoading(true)

    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planType }),
      })
      const body = await response.json().catch(() => ({})) as { url?: string; error?: string }
      if (response.status === 401) {
        router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`)
        return
      }
      if (!response.ok || !body.url) {
        throw new Error(body.error || "Unable to start checkout")
      }
      window.location.assign(body.url)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to start checkout")
    } finally {
      setLoading(false)
    }
  }

  return <div>
    <Button
      variant={billingEnabled ? "default" : "outline"}
      className={className}
      disabled={!billingEnabled || loading}
      onClick={handleUpgrade}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {!billingEnabled ? "Billing staged" : children || `Choose ${plan.name}`}
    </Button>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </div>
}
