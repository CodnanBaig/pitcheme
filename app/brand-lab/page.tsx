import type { Metadata } from "next"
import { BrandLabOverview } from "@/components/brand-lab/brand-option-page"

export const metadata: Metadata = {
  title: "Visual Direction Lab | PitchGenie",
  description: "Compare four visual directions for the PitchGenie product workspace.",
}

export default function BrandLabPage() {
  return <BrandLabOverview />
}
