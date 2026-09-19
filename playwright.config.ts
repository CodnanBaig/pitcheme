import { chromium, defineConfig, devices } from "@playwright/test"

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3200"
const databaseURL = process.env.E2E_DATABASE_URL
  || process.env.DATABASE_URL
  || "mongodb://127.0.0.1:27017/pitchgenie-e2e?replicaSet=rs0"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // Managed MongoDB adds network latency to registration, session refresh,
  // and document writes. Keep browser assertions deterministic for both the
  // local replica set and the production-shaped Atlas rehearsal.
  expect: {
    timeout: 15_000,
  },
  // Product journeys intentionally cover several persisted writes and
  // exports; a managed database can make the complete journey exceed the
  // local 30-second default.
  timeout: 120_000,
  projects: [
    {
      name: "chromium",
      testIgnore: /mobile.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testMatch: /mobile.*\.spec\.ts/,
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: process.env.CI
      ? "pnpm start -p 3200"
      : "pnpm db:deploy && pnpm build && pnpm start -p 3200",
    url: `${baseURL}/api/health/live`,
    // A readiness suite must build and start the current worktree by default;
    // opt into reuse only when explicitly debugging against an existing server.
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "true",
    timeout: 180_000,
    env: {
      ...process.env,
      DATABASE_URL: databaseURL,
      NEXTAUTH_URL: baseURL,
      NEXTAUTH_SECRET: process.env.E2E_NEXTAUTH_SECRET || "e2e-only-secret-that-is-at-least-32-characters-long",
      OPENROUTER_API_KEY: process.env.E2E_OPENROUTER_API_KEY || "e2e-placeholder-key",
      APP_VERSION: process.env.E2E_APP_VERSION || process.env.APP_VERSION || "e2e-local",
      BUILD_SHA: process.env.E2E_BUILD_SHA || process.env.BUILD_SHA || "e2e-local",
      E2E_TEST_MODE: "true",
      STRIPE_BILLING_ENABLED: "false",
      HEALTHCHECK_EXTERNAL_SERVICES: "false",
      HEALTHCHECK_EXPORT_RUNTIME: "true",
      HEALTHCHECK_DATABASE_INDEXES: "true",
      RATE_LIMIT_STORE: "mongodb",
      CHROMIUM_EXECUTABLE_PATH: process.env.CHROMIUM_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || chromium.executablePath(),
    },
  },
})
