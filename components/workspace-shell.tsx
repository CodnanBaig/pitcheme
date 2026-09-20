"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  FilePlus2,
  Files,
  LayoutDashboard,
  Presentation,
  Settings,
} from "lucide-react"
import { AuthButton } from "@/components/auth-button"
import { BrandMark } from "@/components/brand-mark"
import { MobileNav } from "@/components/mobile-nav"
import { cn } from "@/lib/utils"

export type WorkspaceRoute = "dashboard" | "documents" | "proposal" | "pitch-deck" | "settings" | "billing" | "editor"

type WorkspaceShellProps = {
  active?: WorkspaceRoute
  children: ReactNode
  planName?: ReactNode
  contentClassName?: string
}

function workspaceRoute(pathname: string): WorkspaceRoute {
  if (pathname === "/dashboard") return "dashboard"
  if (pathname.startsWith("/generate/proposal")) return "proposal"
  if (pathname.startsWith("/generate/pitch-deck")) return "pitch-deck"
  if (pathname.startsWith("/documents/") && pathname.endsWith("/edit")) return "editor"
  if (pathname.startsWith("/documents") || pathname.startsWith("/proposal/") || pathname.startsWith("/pitch-deck/")) return "documents"
  if (pathname.startsWith("/billing")) return "billing"
  return "settings"
}

function workspaceWidth(pathname: string): string | undefined {
  if (pathname.startsWith("/documents/") && pathname.endsWith("/edit")) return "max-w-6xl"
  if (pathname.startsWith("/billing") || pathname.startsWith("/proposal/") || pathname.startsWith("/pitch-deck/")) return "max-w-5xl"
  return undefined
}

const navGroups = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, active: ["dashboard"] },
      { href: "/documents", label: "Documents", icon: Files, active: ["documents", "editor"] },
    ],
  },
  {
    label: "Create",
    items: [
      { href: "/generate/proposal", label: "New proposal", icon: FilePlus2, active: ["proposal"] },
      { href: "/generate/pitch-deck", label: "New pitch deck", icon: Presentation, active: ["pitch-deck"] },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/settings", label: "Settings", icon: Settings, active: ["settings", "billing"] },
    ],
  },
] as const

const mobileItems = navGroups.flatMap((group) => group.items.map(({ href, label }) => ({ href, label })))

export function WorkspaceShell({ active, children, planName, contentClassName }: WorkspaceShellProps) {
  const pathname = usePathname()
  const resolvedActive = active ?? workspaceRoute(pathname)
  const resolvedContentClassName = contentClassName ?? workspaceWidth(pathname)

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-[#0d1b2a] text-white md:flex">
        <div className="flex h-20 items-center border-b border-white/10 px-6">
          <BrandMark href="/dashboard" inverse />
        </div>
        <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-6" aria-label="Workspace navigation">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = (item.active as readonly string[]).includes(resolvedActive)
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive ? "bg-[#0e7373] text-white" : "text-slate-300 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Current plan</p>
            <p className="mt-1 text-sm font-medium text-white">{planName || "Workspace"}</p>
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-400">Account</span>
            <div className="text-white"><AuthButton /></div>
          </div>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur md:hidden">
          <BrandMark href="/dashboard" />
          <div className="flex items-center gap-1">
            <MobileNav items={mobileItems} label="Open workspace navigation" />
            <AuthButton />
          </div>
        </header>
        <main className={cn("mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8", resolvedContentClassName)}>{children}</main>
      </div>
    </div>
  )
}
