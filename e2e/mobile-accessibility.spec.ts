import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

const publicRoutes = ["/", "/pricing", "/auth/signin", "/auth/signup"]

async function expectNoBlockingViolations(page: Page, route: string) {
  await page.goto(route)
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze()
  const blockingViolations = results.violations.filter((violation) =>
    violation.impact === "serious" || violation.impact === "critical",
  )

  expect(
    blockingViolations,
    `${route}: ${blockingViolations.map((violation) => `${violation.id}: ${violation.help}`).join("\n")}`,
  ).toEqual([])
}

test.describe("mobile accessibility smoke", () => {
  for (const route of publicRoutes) {
    test(`${route} has no serious or critical accessibility violations`, async ({ page }) => {
      await expectNoBlockingViolations(page, route)
    })
  }

  test("authenticated workspace routes have no serious or critical violations", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-for": "198.51.100.244" })
    const email = `mobile-axe-${Date.now()}@example.com`
    const password = "TestPassword!123"

    await page.goto("/auth/signup")
    await page.getByLabel("Name (Optional)").fill("Mobile Axe E2E")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(password)
    await page.getByRole("button", { name: "Create Account" }).click()
    await expect(page).toHaveURL(/\/auth\/signin\?message=/)
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(password)
    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    for (const route of ["/dashboard", "/documents", "/settings"]) {
      await expectNoBlockingViolations(page, route)
    }
  })
})
