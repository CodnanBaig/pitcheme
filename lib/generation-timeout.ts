/** Maximum time allowed for one provider call when no route-level deadline exists. */
export const AI_REQUEST_TIMEOUT_MS = 45_000

/** Shared request deadline across retries, repairs, and model fallbacks. */
export const AI_GENERATION_DEADLINE_MS = 55_000
