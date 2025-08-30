"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { STRIPE_PLANS, type PlanType } from "@/lib/stripe"

interface UpgradeButtonProps {
  planType: PlanType
  className?: string
  children?: React.ReactNode
}

export function UpgradeButton({ planType, className, children }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false)
  const plan = STRIPE_PLANS[planType]

  const handleUpgrade = async () => {
    if (planType === "FREE") return

    setLoading(true)
    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId: plan.priceId,
          planType,
        }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  if (planType === "FREE") {
    return (
      <Button variant="outline" className={className} disabled>
        Current Plan
      </Button>
    )
  }

  return (
    <Button onClick={handleUpgrade} disabled={loading} className={className}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children || `Upgrade to ${plan.name}`}
    </Button>
  )
}
