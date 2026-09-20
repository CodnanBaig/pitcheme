/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react"
import { DocumentsWorkspace } from "@/components/documents-workspace"

describe("DocumentsWorkspace degraded state", () => {
  it("does not present an unavailable document read as an empty workspace", () => {
    render(
      <DocumentsWorkspace
        documents={[]}
        user={{ name: "Test User", email: "test@example.com" }}
        loadError
      />,
    )

    expect(screen.getByRole("alert")).toHaveTextContent("Document data is temporarily unavailable.")
    expect(screen.getByRole("heading", { name: "Documents unavailable" })).toBeInTheDocument()
    expect(screen.getByText("Unavailable")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Search documents" })).toBeDisabled()
    expect(screen.getAllByRole("combobox")).toHaveLength(3)
    expect(screen.getAllByRole("combobox").every((control) => (control as HTMLSelectElement).disabled)).toBe(true)
  })
})
