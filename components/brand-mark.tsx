import Link from "next/link"
import { cn } from "@/lib/utils"

type BrandMarkProps = {
  href?: string
  inverse?: boolean
  compact?: boolean
  className?: string
}

function Mark({ inverse = false }: Pick<BrandMarkProps, "inverse">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-8 w-8 grid-cols-3 items-end gap-[3px] rounded-md border p-[6px]",
        inverse ? "border-white/20 bg-white/10" : "border-[#0d1b2a]/15 bg-white",
      )}
    >
      <span className={cn("h-2 rounded-[1px]", inverse ? "bg-white/70" : "bg-[#738092]")} />
      <span className="h-4 rounded-[1px] bg-[#18a6a6]" />
      <span className={cn("h-3 rounded-[1px]", inverse ? "bg-white" : "bg-[#0d1b2a]")} />
    </span>
  )
}

export function BrandMark({ href, inverse = false, compact = false, className }: BrandMarkProps) {
  const content = (
    <>
      <Mark inverse={inverse} />
      {!compact && (
        <span className={cn("text-[17px] font-semibold tracking-[-0.03em]", inverse ? "text-white" : "text-[#0d1b2a]")}>
          PitchGenie
        </span>
      )}
    </>
  )

  const classes = cn("inline-flex items-center gap-2.5", className)
  return href ? <Link href={href} className={classes}>{content}</Link> : <div className={classes}>{content}</div>
}
