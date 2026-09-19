/** Keep Chromium startup/render work below the 60-second route budget. */
export const EXPORT_LAUNCH_TIMEOUT_MS = 10_000
export const EXPORT_RENDER_TIMEOUT_MS = 20_000

export function throwIfExportAborted(signal: AbortSignal): void {
  if (!signal.aborted) return
  const error = new Error("Export request aborted")
  error.name = "AbortError"
  throw error
}

export async function withExportTimeout<T>(operation: Promise<T>, timeoutMs = EXPORT_RENDER_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Export operation timed out")), timeoutMs)
  })

  try {
    return await Promise.race([operation, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
