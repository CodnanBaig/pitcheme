/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { DocumentEditor } from "@/components/document-editor"

describe("DocumentEditor pitch deck fields", () => {
  it("exposes structured slide fields and regenerates the rendered payload", async () => {
    render(
      <DocumentEditor
        document={{
          id: "507f1f77bcf86cd799439011",
          type: "pitch-deck",
          clientName: "Acme",
          clientCompany: "Acme Inc.",
          projectTitle: "Acme deck",
          revision: "rev-1",
          content: '<div class="slide"><h1>Problem</h1><ul><li>A costly gap</li></ul></div>',
        }}
      />,
    )

    await waitFor(() => expect(screen.getByLabelText("Slide 1 title")).toHaveValue("Problem"))
    fireEvent.change(screen.getByLabelText("Slide 1 title"), { target: { value: "Updated problem" } })

    expect((screen.getByLabelText("Document content") as HTMLTextAreaElement).value).toContain("Updated problem")
    expect(screen.getByText("Structured edit")).toBeInTheDocument()
  })

  it("uses the restored revision for the next autosave", async () => {
    const jsonResponse = (body: unknown) => ({ ok: true, json: async () => body } as Response)
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse({
        versions: [{ id: "version-1", version: 1, projectTitle: "Original", createdAt: new Date().toISOString() }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        document: {
          id: "507f1f77bcf86cd799439011",
          type: "proposal",
          clientName: "Acme",
          clientCompany: "Acme Inc.",
          projectTitle: "Restored",
          content: "Restored content",
        },
        revision: "rev-2",
      }))
      .mockResolvedValueOnce(jsonResponse({ versions: [] }))
      .mockResolvedValueOnce(jsonResponse({
        document: {
          id: "507f1f77bcf86cd799439011",
          type: "proposal",
          clientName: "Acme",
          clientCompany: "Acme Inc.",
          projectTitle: "Restored",
          content: "Edited after restore",
        },
        revision: "rev-3",
      }))

    jest.spyOn(window, "confirm").mockReturnValue(true)

    render(
      <DocumentEditor
        document={{
          id: "507f1f77bcf86cd799439011",
          type: "proposal",
          clientName: "Acme",
          clientCompany: "Acme Inc.",
          projectTitle: "Original",
          revision: "rev-1",
          content: "Original content",
        }}
      />,
    )

    await waitFor(() => expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Restore" }))
    await waitFor(() => expect(screen.getByDisplayValue("Restored content")).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText("Document content"), { target: { value: "Edited after restore" } })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/507f1f77bcf86cd799439011",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ "If-Match": '"rev-2"' }),
      }),
    ))
  })
})
