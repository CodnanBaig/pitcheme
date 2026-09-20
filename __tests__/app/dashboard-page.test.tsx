/** @jest-environment jsdom */

jest.mock("@/auth", () => ({ auth: jest.fn() }))
jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}))
jest.mock("@/lib/subscription", () => ({
  getCachedUserSubscription: jest.fn(),
  getUserUsage: jest.fn(),
}))

import { render, screen } from "@testing-library/react"
import { auth } from "@/auth"
import DashboardPage from "@/app/(workspace)/dashboard/page"
import { prisma } from "@/lib/prisma"
import { getCachedUserSubscription, getUserUsage } from "@/lib/subscription"

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockFindMany = prisma.document.findMany as jest.MockedFunction<typeof prisma.document.findMany>
const mockCount = prisma.document.count as jest.MockedFunction<typeof prisma.document.count>
const mockGetSubscription = getCachedUserSubscription as jest.MockedFunction<typeof getCachedUserSubscription>
const mockGetUsage = getUserUsage as jest.MockedFunction<typeof getUserUsage>

describe("Dashboard billing messaging", () => {
  const originalBillingFlag = process.env.STRIPE_BILLING_ENABLED

  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: "user-1", name: "Test User", email: "test@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    } as never)
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)
    mockGetSubscription.mockResolvedValue({ plan: "FREE" } as never)
    mockGetUsage.mockResolvedValue({ userId: "user-1", month: "2099-01", proposals: 0, pitchDecks: 0 })
  })

  afterAll(() => {
    if (originalBillingFlag === undefined) delete process.env.STRIPE_BILLING_ENABLED
    else process.env.STRIPE_BILLING_ENABLED = originalBillingFlag
  })

  it("shows the upgrade CTA only when billing is enabled", async () => {
    process.env.STRIPE_BILLING_ENABLED = "true"

    const page = await DashboardPage()
    render(page as React.ReactElement)

    expect(screen.getByText("Upgrade to Pro")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Upgrade Now" })).toHaveAttribute("href", "/pricing")
  })

  it("keeps paid billing staged when billing is disabled", async () => {
    process.env.STRIPE_BILLING_ENABLED = "false"

    const page = await DashboardPage()
    render(page as React.ReactElement)

    expect(screen.getByText("Paid plans staged")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View plan details" })).toHaveAttribute("href", "/pricing")
    expect(screen.queryByText("Upgrade to Pro")).not.toBeInTheDocument()
  })
})
