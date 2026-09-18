import { GET } from "@/app/api/health/live/route"
import { NextRequest } from "next/server"

describe("GET /api/health/live", () => {
  it("reports process liveness without probing external services", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/api/health/live"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe("healthy")
    expect(body.timestamp).toEqual(expect.any(String))
    expect(body.requestId).toEqual(expect.any(String))
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })
})
