/** @jest-environment jsdom */

import { act, render, screen } from "@testing-library/react"
import { GenerationProgress } from "@/components/generation-progress"

describe("GenerationProgress", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("announces the estimated workflow and advances stages", () => {
    render(<GenerationProgress documentType="proposal" accent="primary" />)

    expect(screen.getByRole("region", { name: "Generating proposal" })).toBeInTheDocument()
    expect(screen.getByText("Brief ready")).toBeInTheDocument()
    expect(screen.getByText("Preparing your requirements")).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(4_000)
    })

    expect(screen.getByText("Drafting content")).toBeInTheDocument()
    expect(screen.getByText("Building the core narrative")).toBeInTheDocument()
  })
})
