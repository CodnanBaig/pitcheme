import { Suspense, type ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { WorkspaceShell } from "@/components/workspace-shell"
import { getUserSubscription } from "@/lib/subscription"
import { STRIPE_PLANS } from "@/lib/stripe"

export const runtime = "nodejs"

async function WorkspacePlan({ userId }: { userId: string }) {
  try {
    const subscription = await getUserSubscription(userId)
    const plan = STRIPE_PLANS[subscription?.plan || "FREE"] || STRIPE_PLANS.FREE
    return `${plan.name} plan`
  } catch {
    return "Plan unavailable"
  }
}

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  return (
    <WorkspaceShell
      planName={
        <Suspense fallback="Workspace plan">
          <WorkspacePlan userId={session.user.id} />
        </Suspense>
      }
    >
      {children}
    </WorkspaceShell>
  )
}
