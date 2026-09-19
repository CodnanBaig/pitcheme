"use client"
import { useState, useEffect, useRef, useId, Suspense } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock } from "lucide-react"
import Link from "next/link"
import { AuthFrame } from "@/components/auth-frame"

function SignInContent() {
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
        setSignInAttempted(true)

        // Safety timeout in case session doesn't update
        timeoutRef.current = setTimeout(() => {
          setIsLoading(false)
          setSignInAttempted(false)
          setError("Sign in successful but session not updated. Please try refreshing the page.")
          timeoutRef.current = null
        }, 10000) // 10 second timeout
      }
    } catch (err) {
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
      <AuthFrame><div className="text-center text-sm text-muted-foreground">Loading...</div></AuthFrame>
    )
  }

  return (
    <AuthFrame>
      <Card className="w-full">
        <CardHeader>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">Secure workspace access</p>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to continue to your document workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {successMessage && (
            <div className="rounded-md border border-primary/20 bg-accent p-3 text-sm text-accent-foreground">
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
            <Button type="submit" disabled={isLoading} className="w-full">
              <Lock className="w-4 h-4 mr-2" />
              {isLoading
                ? (signInAttempted ? "Redirecting..." : "Signing in...")
                : "Sign In"
              }
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/auth/signup" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthFrame>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<AuthFrame><div className="text-center text-sm text-muted-foreground">Loading...</div></AuthFrame>}>
      <SignInContent />
    </Suspense>
  )
}
