import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type PageHeadingProps = {
  eyebrow: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeading({ eyebrow, title, description, actions, className }: PageHeadingProps) {
  return (
    <div className={cn("mb-8 flex flex-col justify-between gap-5 border-b border-border pb-7 sm:flex-row sm:items-end", className)}>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
        <h1 className="text-3xl font-semibold text-foreground sm:text-[2rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
