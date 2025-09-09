"use client"
import { useState, useEffect, useRef } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, Lock } from "lucide-react"
import Link from "next/link"

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [signInAttempted, setSignInAttempted] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const emailId = useId()
  const passwordId = useId()

  useEffect(() => {
    // Clean up timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Only redirect if we have a session and we're not in the middle of signing in
    if (session && status === "authenticated" && signInAttempted) {
      console.log("Session detected after sign-in, redirecting to dashboard...")
      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      router.push("/dashboard")
    }

    const message = searchParams.get("message")
    if (message) {
      setSuccessMessage(message)
    }
  }, [session, status, router, searchParams, signInAttempted])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSignInAttempted(false)

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid email or password")
        setIsLoading(false)
      } else if (result?.ok) {
        // Sign in successful - set flag and wait for session update
        console.log("Sign in successful, waiting for session update...")
        setSignInAttempted(true)

        // Safety timeout in case session doesn't update
        timeoutRef.current = setTimeout(() => {
          console.log("Session update timeout, resetting loading state")
          setIsLoading(false)
          setSignInAttempted(false)
          setError("Sign in successful but session not updated. Please try refreshing the page.")
          timeoutRef.current = null
        }, 10000) // 10 second timeout
      }
    } catch (err) {
      console.error("Sign in error:", err)
      setError("An error occurred during sign in")
      setIsLoading(false)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">PitchGenie</span>
          </div>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {successMessage && (
            <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
              {successMessage}
            </div>
          )}
          
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {/* Email and Password Sign In */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={emailId}>Email</Label>
              <Input id={emailId} name="email" type="email" placeholder="Enter your email" required className="w-full" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={passwordId}>Password</Label>
              <Input id={passwordId} name="password" type="password" placeholder="Enter your password" required className="w-full" />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90">
              <Lock className="w-4 h-4 mr-2" />
              {isLoading
                ? (signInAttempted ? "Redirecting..." : "Signing in...")
                : "Sign In"
              }
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/auth/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
