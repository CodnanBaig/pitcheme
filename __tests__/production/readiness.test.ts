import fs from "node:fs"
import path from "node:path"
import nextConfig from "@/next.config"
import { getRuntimeEnvironmentStatus } from "@/lib/env"
import { isMongoObjectId } from "@/lib/mongo-id"

describe("production readiness contracts", () => {
  it("uses MongoDB and declares the generation audit model", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8")

    expect(schema).toContain('provider = "mongodb"')
    expect(schema).toContain("model Generation")
    expect(schema).toContain("@@index([requestId, createdAt])")
  })

  it("exposes the expected quality scripts", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts).toMatchObject({
      lint: expect.any(String),
      typecheck: expect.any(String),
      test: expect.any(String),
      "test:ci": expect.any(String),
      "test:e2e": expect.any(String),
      "eval:ai": expect.any(String),
      build: expect.any(String),
    })
  })

  it("rejects insecure production configuration", () => {
    const original = {
      nodeEnv: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      nextAuthSecret: process.env.NEXTAUTH_SECRET,
      openRouterKey: process.env.OPENROUTER_API_KEY,
    }

    try {
      process.env.NODE_ENV = "production"
      process.env.DATABASE_URL = "postgresql://localhost/app"
      process.env.NEXTAUTH_URL = "http://localhost:3000"
      process.env.NEXTAUTH_SECRET = "short"
      delete process.env.OPENROUTER_API_KEY

      const status = getRuntimeEnvironmentStatus()

      expect(status.ok).toBe(false)
      expect(status.errors.length).toBeGreaterThanOrEqual(4)
    } finally {
      process.env.NODE_ENV = original.nodeEnv
      process.env.DATABASE_URL = original.databaseUrl
      process.env.NEXTAUTH_URL = original.nextAuthUrl
      process.env.NEXTAUTH_SECRET = original.nextAuthSecret
      process.env.OPENROUTER_API_KEY = original.openRouterKey
    }
  })

  it("accepts a secure production configuration", () => {
    const originalNodeEnv = process.env.NODE_ENV
    const originalUrl = process.env.NEXTAUTH_URL
    const originalSecret = process.env.NEXTAUTH_SECRET
    const originalKey = process.env.OPENROUTER_API_KEY

    try {
      process.env.NODE_ENV = "production"
      process.env.NEXTAUTH_URL = "https://pitchgenie.example.com"
      process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
      process.env.OPENROUTER_API_KEY = "configured-provider-key"

      expect(getRuntimeEnvironmentStatus()).toMatchObject({ ok: true, missing: [], errors: [] })
    } finally {
      process.env.NODE_ENV = originalNodeEnv
      process.env.NEXTAUTH_URL = originalUrl
      process.env.NEXTAUTH_SECRET = originalSecret
      process.env.OPENROUTER_API_KEY = originalKey
    }
  })

  it("keeps the production security headers configured", async () => {
    const originalNodeEnv = process.env.NODE_ENV
    try {
      process.env.NODE_ENV = "production"
      const headerGroups = await nextConfig.headers?.()
      const headers = Object.fromEntries((headerGroups?.[0]?.headers ?? []).map((header) => [header.key, header.value]))

      expect(headers["X-Frame-Options"]).toBe("DENY")
      expect(headers["X-Content-Type-Options"]).toBe("nosniff")
      expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin")
      expect(headers["Content-Security-Policy"]).toContain("default-src 'self'")
      expect(headers["Strict-Transport-Security"]).toContain("max-age=31536000")
    } finally {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  it("uses bounded Mongo ObjectIds for persisted resources", () => {
    expect(isMongoObjectId("507f1f77bcf86cd799439011")).toBe(true)
    expect(isMongoObjectId("prop_123_abc")).toBe(false)
  })
})
