import { expect, test, type Page } from "@playwright/test"

async function expectNoHorizontalOverflow(page: Page) {
  const fitsViewport = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  expect(fitsViewport, `Page width exceeds viewport: ${await page.evaluate(() => document.documentElement.scrollWidth)}px`).toBe(true)
}

test.describe("mobile smoke", () => {
  test("keeps the public layout within the viewport and exposes navigation", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: /Generate Winning Proposals/i })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expect(page.getByRole("link", { name: "Explore the workflow" })).toHaveAttribute("href", "#features")
    await expect(page.getByRole("link", { name: "Get Started Free" })).toHaveAttribute("href", "/auth/signup")

    await page.getByRole("button", { name: "Open navigation" }).click()
    await expect(page.getByRole("menuitem", { name: "Pricing" })).toBeVisible()
    await page.getByRole("menuitem", { name: "Pricing" }).click()
    await expect(page).toHaveURL(/#pricing$/)
  })

  test("keeps authenticated workspace navigation reachable", async ({ page }) => {
    const email = `mobile-${Date.now()}@example.com`
    const password = "TestPassword!123"
    await page.setExtraHTTPHeaders({ "x-forwarded-for": "198.51.100.243" })

    await page.goto("/auth/signup")
    await page.getByLabel("Name (Optional)").fill("Mobile E2E")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(password)
    await page.getByRole("button", { name: "Create Account" }).click()
    await expect(page).toHaveURL(/\/auth\/signin\?message=/)

    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(password)
    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expectNoHorizontalOverflow(page)

    await page.getByRole("button", { name: "Open navigation" }).click()
    await page.getByRole("menuitem", { name: "Documents" }).click()
    await expect(page).toHaveURL(/\/documents$/)
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.getByRole("button", { name: "Open navigation" }).click()
    await page.getByRole("menuitem", { name: "Settings" }).click()
    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})
