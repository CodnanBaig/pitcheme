import Link from "next/link"
import { AuthButton } from "@/components/auth-button"
import { BrandMark } from "@/components/brand-mark"
import { MobileNav, type MobileNavItem } from "@/components/mobile-nav"

type PublicHeaderProps = {
  homeAnchors?: boolean
}

export function PublicHeader({ homeAnchors = false }: PublicHeaderProps) {
  const items: MobileNavItem[] = [
    { href: homeAnchors ? "#features" : "/#features", label: "Capabilities" },
    { href: homeAnchors ? "#workflow" : "/#workflow", label: "Workflow" },
    { href: homeAnchors ? "#pricing" : "/pricing", label: "Pricing" },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-[#d7e0e7] bg-white/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <BrandMark href="/" />
        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary navigation">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <MobileNav items={items} />
          <AuthButton />
        </div>
      </div>
    </header>
  )
}
