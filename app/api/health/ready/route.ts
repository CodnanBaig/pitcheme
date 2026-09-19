// Readiness uses the full dependency/configuration probe from the canonical health route.
export const runtime = "nodejs"
export const maxDuration = 10

export { GET } from "@/app/api/health/route"
