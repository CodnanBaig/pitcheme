/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react"
import { FieldSelector } from "@/components/field-selector"

describe("FieldSelector", () => {
  it("selects an industry with pointer and keyboard input", () => {
    const onFieldSelect = jest.fn()
    render(<FieldSelector documentType="proposal" onFieldSelect={onFieldSelect} />)

    const technology = screen.getByRole("button", { name: "Select Technology & Software Development industry" })
    fireEvent.click(technology)
    expect(onFieldSelect).toHaveBeenLastCalledWith("technology")

    const healthcare = screen.getByRole("button", { name: "Select Healthcare & Medical Services industry" })
    fireEvent.keyDown(healthcare, { key: "Enter" })
    expect(onFieldSelect).toHaveBeenLastCalledWith("healthcare")

    fireEvent.keyDown(technology, { key: " " })
    expect(onFieldSelect).toHaveBeenLastCalledWith("technology")
  })
})
