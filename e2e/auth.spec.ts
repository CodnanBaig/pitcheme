import { expect, test } from "@playwright/test"

test.describe("credentials journey", () => {
  test("keeps public sign-in and account-creation actions distinct", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("link", { name: "Sign In", exact: true })).toHaveAttribute("href", "/auth/signin")
    await expect(page.getByRole("link", { name: "Get Started", exact: true })).toHaveAttribute("href", "/auth/signup")
  })

  test("redirects unauthenticated visitors away from protected routes", async ({ page }) => {
    await page.goto("/dashboard")

    await expect(page).toHaveURL(/\/auth\/signin$/)
    await expect(page.getByText("Welcome back", { exact: true })).toBeVisible()
  })

  test("keeps invalid credentials on the sign-in page with a useful error", async ({ page }) => {
    await page.goto("/auth/signin")
    await page.getByLabel("Email").fill("missing-account@example.com")
    await page.getByLabel("Password").fill("WrongPassword!123")
    await page.getByRole("button", { name: "Sign In" }).click()

    await expect(page).toHaveURL(/\/auth\/signin$/)
    await expect(page.getByText("Invalid email or password", { exact: true })).toBeVisible()
  })

  test("registers, signs in, opens the account menu, and signs out", async ({ page }) => {
    const uniqueEmail = `e2e-${Date.now()}-${test.info().workerIndex}@example.com`
    const password = "TestPassword!123"
    await page.setExtraHTTPHeaders({ "x-forwarded-for": "198.51.100.241" })

    await page.goto("/auth/signup")
    await page.getByLabel("Name (Optional)").fill("E2E Tester")
    await page.getByLabel("Email").fill(uniqueEmail)
    await page.getByLabel("Password").fill(password)
    await page.getByRole("button", { name: "Create Account" }).click()

    await expect(page).toHaveURL(/\/auth\/signin\?message=/)
    await page.getByLabel("Email").fill(uniqueEmail)
    await page.getByLabel("Password").fill(password)
    await page.getByRole("button", { name: "Sign In" }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole("heading", { name: /Welcome back, E2E!/ })).toBeVisible()

    await page.getByRole("button", { name: "E", exact: true }).click()
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible()
    await page.getByRole("menuitem", { name: "Sign out" }).click()

    await expect(page).toHaveURL(/\/auth\/signin$/)
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible()
  })
})

test("pricing keeps paid actions disabled until billing is enabled", async ({ page }) => {
  await page.goto("/pricing")

  await expect(page.getByText("Paid checkout is staged until the deployment enables Stripe test mode.")).toBeVisible()
  const billingButtons = page.getByRole("button", { name: "Billing staged" })
  await expect(billingButtons).toHaveCount(2)
  await expect(billingButtons.nth(0)).toBeDisabled()
  await expect(billingButtons.nth(1)).toBeDisabled()
})
