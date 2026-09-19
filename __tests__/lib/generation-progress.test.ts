import { emitGenerationStage, emitGenerationTextDelta, getGenerationProgressSink, withGenerationProgress } from "@/lib/generation-progress"

describe("generation progress context", () => {
  it("keeps progress callbacks scoped to the active generation", async () => {
    const onStage = jest.fn()
    const onTextDelta = jest.fn()

    expect(getGenerationProgressSink()).toBeUndefined()
    await withGenerationProgress({ onStage, onTextDelta }, async () => {
      expect(getGenerationProgressSink()).toMatchObject({ onStage, onTextDelta })
      await emitGenerationStage("provider")
      await emitGenerationTextDelta("partial output")
    })

    expect(onStage).toHaveBeenCalledWith("provider")
    expect(onTextDelta).toHaveBeenCalledWith("partial output")
    expect(getGenerationProgressSink()).toBeUndefined()
  })

  it("carries the request abort signal through the scoped progress context", async () => {
    const controller = new AbortController()

    await withGenerationProgress({ signal: controller.signal }, async () => {
      expect(getGenerationProgressSink()?.signal).toBe(controller.signal)
    })
  })
})
