import { AsyncLocalStorage } from "node:async_hooks"

export type GenerationStage = "queued" | "provider" | "validating" | "saving" | "completed"

export type GenerationProgressSink = {
  signal?: AbortSignal
  onStage?: (stage: GenerationStage) => void | Promise<void>
  onTextDelta?: (delta: string) => void | Promise<void>
}

const progressStorage = new AsyncLocalStorage<GenerationProgressSink>()

export function withGenerationProgress<T>(sink: GenerationProgressSink, callback: () => T): T {
  return progressStorage.run(sink, callback)
}

export function getGenerationProgressSink(): GenerationProgressSink | undefined {
  return progressStorage.getStore()
}

export async function emitGenerationStage(stage: GenerationStage): Promise<void> {
  await progressStorage.getStore()?.onStage?.(stage)
}

export async function emitGenerationTextDelta(delta: string): Promise<void> {
  await progressStorage.getStore()?.onTextDelta?.(delta)
}
