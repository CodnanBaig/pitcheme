jest.mock("@/auth", () => ({ auth: jest.fn() }))
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: jest.fn(),
    },
  },
}))

import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { PATCH } from "@/app/api/account/profile/route"

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockUserUpdate = prisma.user.update as jest.MockedFunction<typeof prisma.user.update>

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
})
