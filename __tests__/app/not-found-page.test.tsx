/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react"
import NotFound from "@/app/not-found"

describe("global not-found page", () => {
  it("keeps unknown routes inside the enterprise workspace shell", () => {
    render(<NotFound />)

    expect(screen.getByRole("heading", { name: /workspace route is not available/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /return home/i })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth/signin")
    expect(screen.queryByText(/next\.js/i)).not.toBeInTheDocument()
  })
})
