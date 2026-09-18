jest.mock("@/lib/prisma", () => ({
  prisma: {
    generation: {
      create: jest.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import { classifyGenerationError, recordGeneration } from "@/lib/generation-tracking"

const mockCreate = prisma.generation.create as jest.MockedFunction<typeof prisma.generation.create>

describe("generation tracking", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreate.mockResolvedValue({} as never)
  })

  it("records operational metadata without prompt or content fields", async () => {
    await recordGeneration({
      requestId: "req-123",
      userId: "user-123",
      generationType: "proposal",
      documentId: "507f1f77bcf86cd799439011",
      model: "provider/model",
      promptVersion: "proposal-v2-structured-json",
      totalTokens: 1200,
      durationMs: 3400,
      status: "completed",
      repairAttempted: true,
    })

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: "req-123",
        userId: "user-123",
        documentId: "507f1f77bcf86cd799439011",
        generationType: "proposal",
        provider: "openrouter",
        model: "provider/model",
        promptVersion: "proposal-v2-structured-json",
        totalTokens: 1200,
        durationMs: 3400,
        status: "completed",
        repairAttempted: true,
      }),
    })
    const payload = mockCreate.mock.calls[0][0].data
    expect(payload).not.toHaveProperty("prompt")
    expect(payload).not.toHaveProperty("content")
  })

  it("swallows telemetry persistence failures", async () => {
    mockCreate.mockRejectedValue(new Error("database unavailable"))

    await expect(recordGeneration({
      requestId: "req-456",
      userId: "user-123",
      generationType: "pitch-deck",
      status: "failed",
      errorCode: "provider timeout!",
    })).resolves.toBeUndefined()

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        errorCode: "provider_timeout_",
        status: "failed",
      }),
    })
  })

  it("classifies timeout errors without exposing provider text", () => {
    expect(classifyGenerationError(new Error("upstream timeout with secret details"))).toBe("provider_timeout")
    expect(classifyGenerationError(new Error("unexpected failure"))).toBe("generation_failed")
  })
})
