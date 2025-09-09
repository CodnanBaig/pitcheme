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
    // Stripe disabled: no-op
    return
  }

  // Show disabled state since billing is not available
  return (
    <Button variant="outline" className={className} disabled>
      Billing disabled
    </Button>
  )
}
