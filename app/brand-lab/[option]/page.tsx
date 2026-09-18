import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BrandOptionPage, brandOptions, getBrandOption } from "@/components/brand-lab/brand-option-page"

interface BrandOptionRouteProps {
  params: Promise<{ option: string }>
}

export function generateStaticParams() {
  return brandOptions.map((option) => ({ option: option.slug }))
}

export async function generateMetadata({ params }: BrandOptionRouteProps): Promise<Metadata> {
  const { option: slug } = await params
  const option = getBrandOption(slug)

  return {
    title: option ? `${option.name} Direction | PitchGenie` : "Visual Direction | PitchGenie",
    description: option?.summary,
  }
}

export default async function BrandOptionRoute({ params }: BrandOptionRouteProps) {
  const { option: slug } = await params
  const option = getBrandOption(slug)

  if (!option) {
    notFound()
  }

  return <BrandOptionPage option={option} />
}
