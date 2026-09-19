import { notFound } from "next/navigation"
import BrandLabPage from "@/app/brand-lab/page"
import BrandOptionRoute from "@/app/brand-lab/[option]/page"

describe("internal brand lab access", () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it("remains available outside production for design comparison", async () => {
    process.env.NODE_ENV = "test"

    expect(BrandLabPage()).toBeTruthy()
    expect(await BrandOptionRoute({ params: Promise.resolve({ option: "enterprise" }) })).toBeTruthy()
    expect(notFound).not.toHaveBeenCalled()
  })

  it("returns not found for both routes in production unless explicitly enabled", async () => {
    process.env.NODE_ENV = "production"
    delete process.env.BRAND_LAB_ENABLED

    BrandLabPage()
    await BrandOptionRoute({ params: Promise.resolve({ option: "enterprise" }) })

    expect(notFound).toHaveBeenCalledTimes(2)
  })

  it("allows an explicit production opt-in for an isolated design environment", async () => {
    process.env.NODE_ENV = "production"
    process.env.BRAND_LAB_ENABLED = "true"

    expect(BrandLabPage()).toBeTruthy()
    expect(await BrandOptionRoute({ params: Promise.resolve({ option: "enterprise" }) })).toBeTruthy()
    expect(notFound).not.toHaveBeenCalled()

    delete process.env.BRAND_LAB_ENABLED
  })
})
