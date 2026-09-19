import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BrandLabOverview } from "@/components/brand-lab/brand-option-page"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Visual Direction Lab | PitchGenie",
  description: "Compare four visual directions for the PitchGenie product workspace.",
}

export default function BrandLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.BRAND_LAB_ENABLED !== "true") {
    notFound()
  }

  return <BrandLabOverview />
}
