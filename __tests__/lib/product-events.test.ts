jest.mock("@/lib/prisma", () => ({
  prisma: { productEvent: { create: jest.fn() } },
}))

import { prisma } from "@/lib/prisma"
import { recordProductEvent } from "@/lib/product-events"

const mockCreate = prisma.productEvent.create as jest.MockedFunction<typeof prisma.productEvent.create>

describe("product telemetry", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreate.mockResolvedValue({} as never)
  })

  it("persists bounded operational metadata without sensitive fields", async () => {
    await recordProductEvent({
      name: "export_used",
      userId: "507f1f77bcf86cd799439011",
      documentId: "507f1f77bcf86cd799439012",
      requestId: "req-123",
      metadata: {
        format: "pdf",
        type: "proposal",
        prompt: "do not persist",
        content: "do not persist",
      },
    })

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: "export_used",
        userId: "507f1f77bcf86cd799439011",
        documentId: "507f1f77bcf86cd799439012",
        requestId: "req-123",
        metadata: JSON.stringify({ format: "pdf", type: "proposal" }),
      },
    })
  })

  it("swallows telemetry storage failures so product requests remain available", async () => {
    mockCreate.mockRejectedValue(new Error("database unavailable"))

    await expect(recordProductEvent({
      name: "generation_failed",
      userId: "507f1f77bcf86cd799439011",
      requestId: "req-456",
    })).resolves.toBeUndefined()
  })

  it("records a bounded generation safety block reason", async () => {
    await recordProductEvent({
      name: "generation_blocked",
      userId: "507f1f77bcf86cd799439011",
      requestId: "req-789",
      metadata: { type: "proposal", reason: "prompt-injection" },
    })

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: "generation_blocked",
        userId: "507f1f77bcf86cd799439011",
        requestId: "req-789",
        metadata: JSON.stringify({ type: "proposal", reason: "prompt-injection" }),
      },
    })
  })
})
