/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ShareButton } from "@/components/share-button"

describe("ShareButton", () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    })
  })

  it("creates and copies an owner-issued share path", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ sharePath: "/share/v2.token", expiresInSeconds: 604800 }),
    } as Response)

    render(<ShareButton documentId="507f1f77bcf86cd799439011" />)
    fireEvent.click(screen.getByRole("button", { name: "Share" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/507f1f77bcf86cd799439011/share",
      { method: "POST", credentials: "include" },
    ))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("http://localhost/share/v2.token"))
  })

  it("revokes all active links after owner confirmation", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ revokedCount: 2 }),
    } as Response)
    jest.spyOn(window, "confirm").mockReturnValue(true)

    render(<ShareButton documentId="507f1f77bcf86cd799439011" allowRevoke />)
    fireEvent.click(screen.getByRole("button", { name: "Revoke links" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/507f1f77bcf86cd799439011/share",
      { method: "DELETE", credentials: "include" },
    ))
  })
})
