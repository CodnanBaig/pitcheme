/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ManageSubscriptionButton } from "@/components/manage-subscription-button"
import { UpgradeButton } from "@/components/upgrade-button"

describe("billing controls", () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it("keeps checkout disabled and clearly staged when billing is off", () => {
    const fetchMock = jest.spyOn(global, "fetch")
    render(<UpgradeButton planType="PRO" billingEnabled={false}>Start Pro Trial</UpgradeButton>)

    const button = screen.getByRole("button", { name: "Billing staged" })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("surfaces a checkout failure without pretending navigation succeeded", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "Stripe is temporarily unavailable" }),
    } as Response)
    render(<UpgradeButton planType="PRO" billingEnabled>Start Pro Trial</UpgradeButton>)

    fireEvent.click(screen.getByRole("button", { name: "Start Pro Trial" }))

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Stripe is temporarily unavailable"))
    expect(fetchMock).toHaveBeenCalledWith("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "PRO" }),
    })
  })

  it("keeps the customer portal disabled while billing is staged", () => {
    const fetchMock = jest.spyOn(global, "fetch")
    render(<ManageSubscriptionButton billingEnabled={false} />)

    const button = screen.getByRole("button", { name: "Billing staged" })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("surfaces a portal failure without hiding the error", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: "Portal unavailable" }),
    } as Response)
    render(<ManageSubscriptionButton billingEnabled />)

    fireEvent.click(screen.getByRole("button", { name: "Manage subscription" }))

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Portal unavailable"))
    expect(fetchMock).toHaveBeenCalledWith("/api/stripe/create-portal", { method: "POST" })
  })
})
