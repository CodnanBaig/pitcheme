"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false)

  const handleManageSubscription = async () => {
    // Stripe disabled: no-op
    return
  }

  return (
    <Button disabled variant="outline" className="w-full bg-transparent">
      Billing disabled
    </Button>
  )
}
