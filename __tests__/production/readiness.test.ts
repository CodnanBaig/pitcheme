import fs from "node:fs"
import path from "node:path"
import nextConfig from "@/next.config"
import { getRuntimeEnvironmentStatus } from "@/lib/env"
import { isMongoObjectId } from "@/lib/mongo-id"

describe("production readiness contracts", () => {
  it("uses MongoDB and declares the generation audit model", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8")
    const indexBootstrap = fs.readFileSync(path.join(process.cwd(), "scripts/ensure-mongodb-indexes.mjs"), "utf8")

    expect(schema).toContain('provider = "mongodb"')
    expect(schema).toContain("model Generation")
    expect(schema).toContain("model DocumentShare")
    expect(schema).toContain("tokenHash      String   @unique")
    expect(schema).toContain("model ProductEvent")
    expect(schema).toContain("@@index([name, createdAt])")
    expect(schema).toContain("@@index([expiresAt])")
    expect(schema).toContain("@@index([userId, createdAt])")
    expect(schema).toContain("@@index([requestId, createdAt])")
    expect(schema).toContain("@@index([userId, type, createdAt])")
    expect(schema).toContain("@@index([stripeCustomerId])")
    expect(schema).toContain("@@index([stripeSubscriptionId])")
    expect(indexBootstrap).toContain("DocumentShare_expiresAt_idx")
    expect(indexBootstrap).toContain("ProductEvent_name_createdAt_idx")
    expect(indexBootstrap).toContain("ProductEvent_documentId_createdAt_idx")
  })

  it("exposes the expected quality scripts", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts).toMatchObject({
      lint: expect.any(String),
      "quality:imports": expect.any(String),
      "quality:secrets": expect.any(String),
      "quality:surface": expect.any(String),
      "quality:telemetry": expect.any(String),
      typecheck: expect.any(String),
      test: expect.any(String),
      "test:ci": expect.any(String),
      "test:e2e": expect.any(String),
      "eval:ai": expect.any(String),
      "db:prune:expired": expect.any(String),
      "verify:deployment": expect.any(String),
      build: expect.any(String),
    })
    expect(packageJson.scripts["db:deploy"]).toContain("ensure-mongodb-indexes.mjs")
  })

  it("enforces unused-code checks in the production TypeScript gate", () => {
    const tsconfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "tsconfig.json"), "utf8")) as {
      compilerOptions: { noUnusedLocals?: boolean; noUnusedParameters?: boolean }
    }

    expect(tsconfig.compilerOptions.noUnusedLocals).toBe(true)
    expect(tsconfig.compilerOptions.noUnusedParameters).toBe(true)
  })

  it("keeps the local Playwright database fallback transaction-compatible", () => {
    const playwrightConfig = fs.readFileSync(path.join(process.cwd(), "playwright.config.ts"), "utf8")

    expect(playwrightConfig).toContain("pitchgenie-e2e?replicaSet=rs0")
  })

  it("pins database-backed and long-running handlers to the Node runtime", () => {
    const routeBudgets: Record<string, number> = {
      "app/api/account/profile/route.ts": 30,
      "app/api/auth/[...nextauth]/route.ts": 30,
      "app/api/auth/register/route.ts": 30,
      "app/api/auth/session/route.ts": 30,
      "app/api/documents/route.ts": 30,
      "app/api/documents/[id]/route.ts": 30,
      "app/api/documents/[id]/duplicate/route.ts": 30,
      "app/api/documents/[id]/share/route.ts": 30,
      "app/api/documents/[id]/versions/route.ts": 30,
      "app/api/documents/[id]/versions/[version]/route.ts": 30,
      "app/api/generate/proposal/route.ts": 60,
      "app/api/generate/pitch-deck/route.ts": 60,
      "app/api/generate/proposal/stream/route.ts": 60,
      "app/api/generate/pitch-deck/stream/route.ts": 60,
      "app/api/export/proposal/[id]/route.ts": 60,
      "app/api/export/pitch-deck/[id]/route.ts": 60,
      "app/api/health/route.ts": 10,
      "app/api/health/live/route.ts": 5,
      "app/api/health/ready/route.ts": 10,
      "app/api/telemetry/client-error/route.ts": 5,
    }

    for (const [routeFile, maxDuration] of Object.entries(routeBudgets)) {
      const source = fs.readFileSync(path.join(process.cwd(), routeFile), "utf8")
      expect(source).toContain('export const runtime = "nodejs"')
      expect(source).toContain(`export const maxDuration = ${maxDuration}`)
    }
  })

  it("pins Prisma-backed server pages to the Node runtime", () => {
    for (const pageFile of [
      "app/dashboard/page.tsx",
      "app/documents/page.tsx",
      "app/documents/[id]/edit/page.tsx",
      "app/proposal/[id]/page.tsx",
      "app/pitch-deck/[id]/page.tsx",
      "app/settings/page.tsx",
      "app/billing/page.tsx",
      "app/share/[token]/page.tsx",
    ]) {
      const source = fs.readFileSync(path.join(process.cwd(), pageFile), "utf8")
      expect(source).toContain('export const runtime = "nodejs"')
    }
  })

  it("bounds expensive document exports per account and process", () => {
    const concurrency = fs.readFileSync(path.join(process.cwd(), "lib/export-concurrency.ts"), "utf8")
    const proposalRoute = fs.readFileSync(path.join(process.cwd(), "app/api/export/proposal/[id]/route.ts"), "utf8")
    const pitchDeckRoute = fs.readFileSync(path.join(process.cwd(), "app/api/export/pitch-deck/[id]/route.ts"), "utf8")

    expect(concurrency).toContain("EXPORT_CONCURRENCY_LIMIT = 2")
    expect(concurrency).toContain("document-export:user:")
    expect(concurrency).toContain("document-export:global")
    for (const source of [proposalRoute, pitchDeckRoute]) {
      expect(source).toContain("acquireExportConcurrencySlot")
      expect(source).toContain('"Retry-After": "5"')
      expect(source).toContain("releaseExportSlot?.()")
    }
  })

  it("keeps Chromium export operations inside the route budget", () => {
    const timeout = fs.readFileSync(path.join(process.cwd(), "lib/export-timeout.ts"), "utf8")
    const proposalRoute = fs.readFileSync(path.join(process.cwd(), "app/api/export/proposal/[id]/route.ts"), "utf8")
    const pitchDeckRoute = fs.readFileSync(path.join(process.cwd(), "app/api/export/pitch-deck/[id]/route.ts"), "utf8")

    expect(timeout).toContain("EXPORT_LAUNCH_TIMEOUT_MS = 10_000")
    expect(timeout).toContain("EXPORT_RENDER_TIMEOUT_MS = 20_000")
    expect(timeout).toContain("withExportTimeout")
    expect(timeout).toContain("throwIfExportAborted")
    for (const source of [proposalRoute, pitchDeckRoute]) {
      expect(source).toContain("timeout: EXPORT_LAUNCH_TIMEOUT_MS")
      expect(source).toContain("withExportTimeout(page.pdf")
      expect(source).toContain("signal: request.signal")
      expect(source).toContain("status: 499")
    }
  })

  it("coalesces repeated external readiness probes", () => {
    const healthRoute = fs.readFileSync(path.join(process.cwd(), "app/api/health/route.ts"), "utf8")

    expect(healthRoute).toContain("externalProbeInFlight")
    expect(healthRoute).toContain("if (inFlight) return inFlight")
  })

  it("bounds provider model-catalog health responses", () => {
    const healthRoute = fs.readFileSync(path.join(process.cwd(), "app/api/health/route.ts"), "utf8")
    const boundedJson = fs.readFileSync(path.join(process.cwd(), "lib/bounded-json.ts"), "utf8")

    expect(healthRoute).toContain("readBoundedJsonResponse")
    expect(boundedJson).toContain("DEFAULT_MAX_JSON_RESPONSE_BYTES = 1 * 1024 * 1024")
    expect(boundedJson).toContain("reader.cancel")
  })

  it("bounds streamed and authenticated JSON responses", () => {
    const generationStream = fs.readFileSync(path.join(process.cwd(), "lib/generation-stream.ts"), "utf8")
    const authApi = fs.readFileSync(path.join(process.cwd(), "lib/auth-api.ts"), "utf8")

    expect(generationStream).toContain("readBoundedJsonResponse(response)")
    expect(authApi).toContain("MAX_AUTH_ERROR_RESPONSE_BYTES = 64 * 1024")
    expect(authApi).toContain("MAX_AUTH_JSON_RESPONSE_BYTES = 2 * 1024 * 1024")
    expect(authApi).toContain("readBoundedJsonResponse(response, MAX_AUTH_JSON_RESPONSE_BYTES)")
  })

  it("bounds deployment verifier probe responses", () => {
    const verifier = fs.readFileSync(path.join(process.cwd(), "scripts/verify-deployment.mjs"), "utf8")

    expect(verifier).toContain("MAX_PROBE_RESPONSE_BYTES = 256 * 1024")
    expect(verifier).toContain("non-JSON content type")
    expect(verifier).toContain("readBoundedResponseText")
    expect(verifier).toContain('PUBLIC_PAGE_PROBE_PATHS = ["/", "/pricing"]')
    expect(verifier).toContain("__deployment-not-found-check__")
    expect(verifier).toContain("framework-default error content")
    expect(verifier).toContain("unverifiable build")
    expect(verifier).toContain("non-loopback deployment URLs must use https")
    expect(verifier).toContain('redirect: "manual"')
    expect(verifier).toContain("redirects are not allowed")
  })

  it("keeps development dependencies out of the production container layer", () => {
    const dockerfile = fs.readFileSync(path.join(process.cwd(), "Dockerfile"), "utf8")
    const dockerignore = fs.readFileSync(path.join(process.cwd(), ".dockerignore"), "utf8")

    expect(fs.existsSync(path.join(process.cwd(), "public/.gitkeep"))).toBe(true)
    expect(dockerfile).toContain("FROM dependencies AS production-dependencies")
    expect(dockerfile).toContain("RUN corepack install")
    expect(dockerfile).not.toContain("corepack prepare pnpm@")
    expect(dockerfile).toContain("RUN pnpm prune --prod")
    expect(dockerfile).toContain("COPY --from=production-dependencies")
    expect(dockerignore).toContain(".github")
    expect(dockerignore).toContain("__tests__")
    expect(dockerignore).toContain("e2e")
    expect(dockerignore).toContain("docs")
    expect(dockerignore).toContain("*.md")
  })

  it("keeps dependency maintenance automated", () => {
    const dependabot = fs.readFileSync(path.join(process.cwd(), ".github/dependabot.yml"), "utf8")

    expect(dependabot).toContain("package-ecosystem: npm")
    expect(dependabot).toContain("package-ecosystem: github-actions")
    expect(dependabot).toContain("interval: weekly")
  })

  it("keeps expired-record cleanup dry-run first", () => {
    const cleanup = fs.readFileSync(path.join(process.cwd(), "scripts/prune-expired-records.mjs"), "utf8")
    const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/ci.yml"), "utf8")

    expect(cleanup).toContain("PRUNE_EXPIRED_CONFIRM === \"apply\"")
    expect(cleanup).toContain("prisma.session")
    expect(cleanup).toContain("prisma.verificationToken")
    expect(cleanup).toContain("prisma.rateLimitBucket")
    expect(cleanup).toContain("prisma.$transaction")
    expect(cleanup).toContain("Dry run")
    expect(workflow).toContain("Validate expired-record maintenance")
    expect(workflow).toContain("run: pnpm db:prune:expired")
  })

  it("keeps the local Playwright callback URL aligned with its test server", () => {
    const playwrightConfig = fs.readFileSync(path.join(process.cwd(), "playwright.config.ts"), "utf8")

    expect(playwrightConfig).toContain("NEXTAUTH_URL: baseURL")
    expect(playwrightConfig).toContain("pnpm db:deploy && pnpm build && pnpm start -p 3200")
    expect(playwrightConfig).not.toContain("e2e.example.com")
  })

  it("lets the pnpm action honor the repository package-manager pin", () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/ci.yml"), "utf8")
    const setupBlock = workflow.match(/- name: Set up pnpm([\s\S]*?)(?=\n      - name: Set up Node\.js)/)?.[1]

    expect(setupBlock).toContain("uses: pnpm/action-setup@v4")
    expect(setupBlock).not.toContain("version:")
  })

  it("bounds Stripe provider requests", () => {
    const stripe = fs.readFileSync(path.join(process.cwd(), "lib/stripe.ts"), "utf8")

    expect(stripe).toContain("maxNetworkRetries: 2")
    expect(stripe).toContain("timeout: 10_000")
  })

  it("pins Stripe routes to a bounded Node runtime", () => {
    for (const routeFile of [
      "app/api/stripe/create-checkout/route.ts",
      "app/api/stripe/create-portal/route.ts",
      "app/api/stripe/webhook/route.ts",
    ]) {
      const source = fs.readFileSync(path.join(process.cwd(), routeFile), "utf8")
      expect(source).toContain('export const runtime = "nodejs"')
      expect(source).toContain("export const maxDuration = 30")
    }
  })

  it("uses an explicit hosted Buildx path for the production image gate", () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/ci.yml"), "utf8")
    const dockerfile = fs.readFileSync(path.join(process.cwd(), "Dockerfile"), "utf8")

    expect(workflow).toContain("docker/setup-buildx-action@v3")
    expect(workflow).toContain("docker buildx build --load")
    expect(workflow).toContain('--build-arg APP_VERSION="ci-${GITHUB_SHA}"')
    expect(workflow).toContain('APP_VERSION: ci-${{ github.sha }}')
    expect(dockerfile).toContain("ARG APP_VERSION=unknown")
  })

  it("publishes only tagged images with release provenance", () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/ci.yml"), "utf8")

    expect(workflow).toContain('"v*.*.*"')
    expect(workflow).toContain("if: startsWith(github.ref, 'refs/tags/v') && needs.quality.result == 'success'")
    expect(workflow).toContain("needs: quality")
    expect(workflow).toContain("docker/login-action@v3")
    expect(workflow).toContain("docker/metadata-action@v5")
    expect(workflow).toContain("docker/build-push-action@v6")
    expect(workflow).toContain("push: true")
    expect(workflow).toContain("APP_VERSION=${{ steps.meta.outputs.version }}")
    expect(workflow).toContain("BUILD_SHA=${{ github.sha }}")
    expect(workflow).toContain("provenance: true")
    expect(workflow).toContain("sbom: true")
  })

  it("keeps the provider fallback chain inside the route deadline", () => {
    const timeoutConfig = fs.readFileSync(path.join(process.cwd(), "lib/generation-timeout.ts"), "utf8")
    const aiService = fs.readFileSync(path.join(process.cwd(), "lib/ai-service.ts"), "utf8")
    const proposalRoute = fs.readFileSync(path.join(process.cwd(), "app/api/generate/proposal/route.ts"), "utf8")
    const pitchDeckRoute = fs.readFileSync(path.join(process.cwd(), "app/api/generate/pitch-deck/route.ts"), "utf8")

    expect(timeoutConfig).toContain("export const AI_GENERATION_DEADLINE_MS = 55_000")
    expect(aiService).toContain("abortSignal?: AbortSignal")
    expect(proposalRoute).toContain("AbortSignal.timeout(AI_GENERATION_DEADLINE_MS)")
    expect(pitchDeckRoute).toContain("AbortSignal.timeout(AI_GENERATION_DEADLINE_MS)")
  })

  it("rejects insecure production configuration", () => {
    const original = {
      nodeEnv: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      nextAuthSecret: process.env.NEXTAUTH_SECRET,
      openRouterKey: process.env.OPENROUTER_API_KEY,
      rateLimitStore: process.env.RATE_LIMIT_STORE,
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
      if (original.rateLimitStore === undefined) delete process.env.RATE_LIMIT_STORE
      else process.env.RATE_LIMIT_STORE = original.rateLimitStore
    }
  })

  it("accepts a secure production configuration", () => {
    const originalNodeEnv = process.env.NODE_ENV
    const originalDatabaseUrl = process.env.DATABASE_URL
    const originalUrl = process.env.NEXTAUTH_URL
    const originalSecret = process.env.NEXTAUTH_SECRET
    const originalKey = process.env.OPENROUTER_API_KEY
    const originalRateLimitStore = process.env.RATE_LIMIT_STORE

    try {
      process.env.NODE_ENV = "production"
      process.env.DATABASE_URL = "mongodb://127.0.0.1:27017/pitchgenie?replicaSet=rs0"
      process.env.NEXTAUTH_URL = "https://pitchgenie.example.com"
      process.env.NEXTAUTH_SECRET = "secure-production-secret-that-is-at-least-32-characters"
      process.env.OPENROUTER_API_KEY = "configured-provider-key"
      process.env.HEALTHCHECK_EXPORT_RUNTIME = "true"
      process.env.HEALTHCHECK_DATABASE_INDEXES = "true"
      process.env.RATE_LIMIT_STORE = "mongodb"

      expect(getRuntimeEnvironmentStatus()).toMatchObject({ ok: true, missing: [], errors: [] })
    } finally {
      process.env.NODE_ENV = originalNodeEnv
      process.env.DATABASE_URL = originalDatabaseUrl
      process.env.NEXTAUTH_URL = originalUrl
      process.env.NEXTAUTH_SECRET = originalSecret
      process.env.OPENROUTER_API_KEY = originalKey
      if (originalRateLimitStore === undefined) delete process.env.RATE_LIMIT_STORE
      else process.env.RATE_LIMIT_STORE = originalRateLimitStore
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
      expect(headers["Content-Security-Policy"]).not.toContain("'unsafe-eval'")
      expect(headers["Strict-Transport-Security"]).toContain("max-age=31536000")
    } finally {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  it("keeps production builds independent of remote font fetches", () => {
    const layout = fs.readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8")

    expect(layout).not.toContain("next/font/google")
    expect(layout).not.toContain("DM_Sans")
  })

  it("keeps generation selectors keyboard-operable", () => {
    const fieldSelector = fs.readFileSync(path.join(process.cwd(), "components/field-selector.tsx"), "utf8")
    const dynamicForm = fs.readFileSync(path.join(process.cwd(), "components/dynamic-form-generator.tsx"), "utf8")

    expect(fieldSelector).toContain('role="button"')
    expect(fieldSelector).toContain('tabIndex={0}')
    expect(fieldSelector).toContain('aria-pressed={isSelected}')
    expect(fieldSelector).toContain('event.key === "Enter"')
    expect(fieldSelector).toContain('event.key === " "')
    expect(dynamicForm).toContain('aria-label={`Remove ${selectedValue}`}')
    expect(dynamicForm).toContain('type="button"')
  })

  it("does not ship placeholder public navigation links", () => {
    const landingPage = fs.readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8")

    expect(landingPage).not.toContain('href="#"')
    expect(landingPage).not.toContain("&copy; 2024")
    expect(landingPage).not.toContain("Privacy Policy")
    expect(landingPage).not.toContain("Terms of Service")
    expect(landingPage).not.toContain("Cookie Policy")
  })

  it("keeps superseded generation modules out of the production component inventory", () => {
    for (const supersededFile of [
      "components/pitch-deck-form.tsx",
      "components/proposal-form.tsx",
      "lib/prompt-templates.ts",
    ]) {
      expect(fs.existsSync(path.join(process.cwd(), supersededFile))).toBe(false)
    }

    const generationShell = fs.readFileSync(path.join(process.cwd(), "components/generation-form-shell.tsx"), "utf8")
    expect(generationShell).toContain("enhanced-proposal-form")
    expect(generationShell).toContain("enhanced-pitch-deck-form")
  })

  it("keeps landing-page pricing aligned with the billing release flag", () => {
    const landingPage = fs.readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8")

    expect(landingPage).toContain('export const dynamic = "force-dynamic"')
    expect(landingPage).toContain("isStripeBillingEnabled")
    expect(landingPage).toContain("STRIPE_PLANS")
    expect(landingPage).toContain("Paid plan staged for the billing release")
    expect(landingPage).toContain('href={key === "FREE" ? "/auth/signup" : "/pricing"}')
    expect(landingPage).not.toContain("Start Pro Trial")
    expect(landingPage).not.toContain("Contact Sales")
  })

  it("registers bounded framework-level error telemetry", () => {
    const instrumentation = fs.readFileSync(path.join(process.cwd(), "instrumentation.ts"), "utf8")
    const monitoring = fs.readFileSync(path.join(process.cwd(), "lib/error-monitoring.ts"), "utf8")

    expect(instrumentation).toContain("export function onRequestError")
    expect(instrumentation).toContain("sendRequestErrorTelemetry")
    expect(monitoring).toContain("ERROR_MONITORING_TIMEOUT_MS = 1_500")
    expect(monitoring).toContain("MAX_ERROR_MONITORING_EVENT_BYTES = 8 * 1024")
    expect(monitoring).toContain("AbortSignal.timeout")
    expect(instrumentation).toContain("requestId")
    expect(instrumentation).toContain("error.name.slice(0, 64)")
    expect(instrumentation).not.toContain("error.message")
  })

  it("keeps authentication event logs free of raw account identifiers", () => {
    const authSource = fs.readFileSync(path.join(process.cwd(), "auth.ts"), "utf8")
    const eventSource = authSource.match(/events:\s*\{[\s\S]*?\n\s*\},\n\s*secret:/)?.[0] || ""

    expect(eventSource).toContain('console.log("User signed in"')
    expect(eventSource).not.toContain("userId")
    expect(eventSource).not.toContain("user.email")
  })

  it("keeps internal brand exploration routes out of production by default", () => {
    const landingPage = fs.readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8")
    const publicHeader = fs.readFileSync(path.join(process.cwd(), "components/public-header.tsx"), "utf8")
    expect(landingPage).not.toContain('href="/brand-lab"')
    expect(landingPage).not.toContain("Visual directions")
    expect(publicHeader).not.toContain('href: "/brand-lab"')
    expect(publicHeader).not.toContain("Visual directions")

    for (const routeFile of ["app/brand-lab/page.tsx", "app/brand-lab/[option]/page.tsx"]) {
      const source = fs.readFileSync(path.join(process.cwd(), routeFile), "utf8")

      expect(source).toContain('export const dynamic = "force-dynamic"')
      expect(source).toContain('process.env.NODE_ENV === "production"')
      expect(source).toContain('process.env.BRAND_LAB_ENABLED !== "true"')
      expect(source).toContain("notFound()")
    }

    const dockerfile = fs.readFileSync(path.join(process.cwd(), "Dockerfile"), "utf8")
    const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/ci.yml"), "utf8")
    const verifier = fs.readFileSync(path.join(process.cwd(), "scripts/verify-deployment.mjs"), "utf8")
    expect(dockerfile).toContain('ENV BRAND_LAB_ENABLED="false"')
    expect(workflow).toContain('BRAND_LAB_ENABLED: "false"')
    expect(workflow).toContain("--env BRAND_LAB_ENABLED=false")
    for (const pathName of ["/brand-lab/signal", "/brand-lab/editorial", "/brand-lab/enterprise", "/brand-lab/operator"]) {
      expect(verifier).toContain(`"${pathName}"`)
    }
    expect(verifier).toContain("internal brand-lab link")
  })

  it("documents the preferred and legacy Chromium environment names", () => {
    const envExample = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8")
    const readme = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf8")
    const runbook = fs.readFileSync(path.join(process.cwd(), "docs/PRODUCTION_RUNBOOK.md"), "utf8")

    expect(envExample).toContain('CHROMIUM_EXECUTABLE_PATH=""')
    expect(envExample).toContain('PUPPETEER_EXECUTABLE_PATH=""')
    expect(readme).toContain("use `CHROMIUM_EXECUTABLE_PATH` for new configuration")
    expect(runbook).toContain("compatibility fallback only")
  })

  it("connects critical route failures to bounded operational telemetry", () => {
    const monitoring = fs.readFileSync(path.join(process.cwd(), "lib/error-monitoring.ts"), "utf8")
    expect(monitoring).toContain("sendOperationalErrorTelemetry")
    expect(monitoring).toContain('"generation_failed"')
    expect(monitoring).toContain('"export_failed"')
    expect(monitoring).toContain('"auth_failed"')
    expect(monitoring).toContain('"stripe_failed"')
    expect(monitoring).toContain('"route_failed"')

    for (const routeFile of [
      "app/api/generate/proposal/route.ts",
      "app/api/generate/pitch-deck/route.ts",
      "lib/generation-stream.ts",
      "app/api/export/proposal/[id]/route.ts",
      "app/api/export/pitch-deck/[id]/route.ts",
      "app/api/auth/register/route.ts",
      "app/api/auth/session/route.ts",
      "app/api/stripe/create-checkout/route.ts",
      "app/api/stripe/create-portal/route.ts",
      "app/api/stripe/webhook/route.ts",
      "app/api/account/profile/route.ts",
      "app/api/documents/route.ts",
      "app/api/documents/[id]/route.ts",
      "app/api/documents/[id]/duplicate/route.ts",
      "app/api/documents/[id]/share/route.ts",
      "app/api/documents/[id]/versions/route.ts",
      "app/api/documents/[id]/versions/[version]/route.ts",
      "app/api/telemetry/client-error/route.ts",
    ]) {
      const source = fs.readFileSync(path.join(process.cwd(), routeFile), "utf8")
      expect(source).toContain("sendOperationalErrorTelemetry")
    }
  })

  it("prevents bearer share pages from being cached after revocation", async () => {
    const headerGroups = await nextConfig.headers?.()
    const shareHeaders = headerGroups?.find((group) => group.source === "/share/:token")?.headers ?? []

    expect(shareHeaders).toContainEqual({ key: "Cache-Control", value: "private, no-store, max-age=0" })
    expect(shareHeaders).toContainEqual({ key: "Referrer-Policy", value: "no-referrer" })
  })

  it("uses bounded Mongo ObjectIds for persisted resources", () => {
    expect(isMongoObjectId("507f1f77bcf86cd799439011")).toBe(true)
    expect(isMongoObjectId("prop_123_abc")).toBe(false)
  })
})
