"use client"

import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface SmartCTAButtonProps {
  children: React.ReactNode
  className?: string
  size?: "default" | "sm" | "lg" | "icon"
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
}

export function SmartCTAButton({ 
  children, 
  className, 
  size = "lg", 
  variant = "default" 
}: SmartCTAButtonProps) {
  const { data: session, status } = useSession()

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <Button 
        size={size} 
        variant={variant} 
        className={className} 
        disabled
      >
        Loading...
      </Button>
    )
  }

  // If user is logged in, redirect to dashboard
  if (session) {
    return (
      <Button 
        size={size} 
        variant={variant} 
        className={className} 
        asChild
      >
        <Link href="/dashboard">{children}</Link>
      </Button>
    )
  }

  // If user is not logged in, redirect to signup
  return (
    <Button 
      size={size} 
      variant={variant} 
      className={className} 
      asChild
    >
      <Link href="/auth/signup">{children}</Link>
    </Button>
  )
}
