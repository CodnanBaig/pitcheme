"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function useAuthSession() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshSession = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      const response = await fetch("/api/auth/session")
      if (response.ok) {
        console.log("Session refreshed successfully")
      } else {
        console.error("Failed to refresh session")
        router.push("/auth/signin")
      }
    } catch (error) {
      console.error("Error refreshing session:", error)
      router.push("/auth/signin")
    } finally {
      setIsRefreshing(false)
    }
  }

  return {
    session,
    status,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    user: session?.user,
    refreshSession,
    isRefreshing
  }
}
