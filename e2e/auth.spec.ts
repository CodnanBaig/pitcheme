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

  test("registers, navigates without remounting the workspace, and signs out", async ({ page }) => {
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

    const workspaceNavigation = page.getByRole("navigation", { name: "Workspace navigation" })
    const workspaceShell = page.locator("aside").filter({ has: workspaceNavigation })
    await workspaceShell.evaluate((element) => element.setAttribute("data-navigation-shell", "persistent"))

    await workspaceNavigation.getByRole("link", { name: "Documents" }).click()
    await expect(page).toHaveURL(/\/documents$/)
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible()
    await expect(workspaceShell).toHaveAttribute("data-navigation-shell", "persistent")
    await expect(workspaceNavigation.getByRole("link", { name: "Documents" })).toHaveAttribute("aria-current", "page")

    await workspaceNavigation.getByRole("link", { name: "New proposal" }).click()
    await expect(page).toHaveURL(/\/generate\/proposal$/)
    await expect(page.getByRole("heading", { name: "Generate Proposal" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Select Your Industry" })).toBeVisible()
    await expect(page.getByLabel("Loading generation form")).toHaveCount(0)
    await expect(workspaceShell).toHaveAttribute("data-navigation-shell", "persistent")

    await workspaceNavigation.getByRole("link", { name: "New pitch deck" }).click()
    await expect(page).toHaveURL(/\/generate\/pitch-deck$/)
    await expect(page.getByRole("heading", { name: "Generate Pitch Deck" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Select Your Industry" })).toBeVisible()
    await expect(page.getByLabel("Loading generation form")).toHaveCount(0)
    await expect(workspaceShell).toHaveAttribute("data-navigation-shell", "persistent")

    await workspaceNavigation.getByRole("link", { name: "Overview" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(workspaceShell).toHaveAttribute("data-navigation-shell", "persistent")

    await page.reload()
    await expect(page.getByRole("button", { name: "E", exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: "Sign In", exact: true })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Get Started", exact: true })).toHaveCount(0)

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
