jest.mock("@/auth", () => ({ auth: jest.fn() }))
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: jest.fn(),
    },
  },
}))
jest.mock("@/lib/error-monitoring", () => ({
  sendOperationalErrorTelemetry: jest.fn().mockResolvedValue(undefined),
}))

import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendOperationalErrorTelemetry } from "@/lib/error-monitoring"
import { PATCH } from "@/app/api/account/profile/route"

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockUserUpdate = prisma.user.update as jest.MockedFunction<typeof prisma.user.update>
const mockOperationalTelemetry = sendOperationalErrorTelemetry as jest.MockedFunction<typeof sendOperationalErrorTelemetry>

function request(body: unknown) {
  return new NextRequest("http://localhost:3000/api/account/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("/api/account/profile", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
  })

  it("updates the authenticated user's name", async () => {
    mockUserUpdate.mockResolvedValue({ id: "user-1", name: "Updated Name", email: "user@example.com" } as never)

    const response = await PATCH(request({ name: " Updated Name " }))

    expect(response.status).toBe(200)
    expect(response.headers.get("X-Request-ID")).toEqual(expect.any(String))
    expect(await response.json()).toEqual({
      user: { id: "user-1", name: "Updated Name", email: "user@example.com" },
    })
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Updated Name" },
      select: { id: true, name: true, email: true },
    })
  })

  it("rejects unauthenticated and unsupported updates", async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await PATCH(request({ name: "Nope" }))).status).toBe(401)

    expect((await PATCH(request({ name: "Valid", email: "new@example.com" }))).status).toBe(400)
    expect((await PATCH(request({ name: "x".repeat(121) }))).status).toBe(400)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it("rejects an oversized request body", async () => {
    const response = await PATCH(request({ name: "x".repeat(5_000) }))

    expect(response.status).toBe(413)
    expect((await response.json()).error).toBe("Request body is too large")
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it("forwards bounded telemetry when profile persistence fails", async () => {
    mockUserUpdate.mockRejectedValueOnce(new Error("private profile content"))

    const response = await PATCH(request({ name: "Updated Name" }))
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({ error: "Failed to update profile", requestId: expect.any(String) })
    expect(mockOperationalTelemetry).toHaveBeenCalledWith({
      event: "route_failed",
      requestId: expect.any(String),
      path: "/api/account/profile",
      method: "PATCH",
      category: "profile",
      error: "Error",
    })
    expect(JSON.stringify(mockOperationalTelemetry.mock.calls[0][0])).not.toContain("private profile content")
  })
})
