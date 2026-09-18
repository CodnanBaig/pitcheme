import { expect, test, type Page } from "@playwright/test"

async function registerAndSignIn(page: Page, label: string) {
  const email = `e2e-${label.toLowerCase()}-${Date.now()}@example.com`
  const password = "TestPassword!123"
  const clientOctet = Array.from(label).reduce((total, character) => total + character.charCodeAt(0), 0) % 200 + 1

  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${clientOctet}` })

  await page.goto("/auth/signup")
  await page.getByLabel("Name (Optional)").fill(`E2E ${label}`)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Create Account" }).click()
  await expect(page).toHaveURL(/\/auth\/signin\?message=/)

  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign In" }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText("Welcome back, E2E!", { exact: true })).toBeVisible()
}

test.describe("product journeys", () => {
  test("generates and edits a proposal, then searches and duplicates it", async ({ page }) => {
    await registerAndSignIn(page, "Proposal")

    await page.goto("/generate/proposal")
    await page.getByText("Technology & Software Development", { exact: true }).click()
    await page.locator("#clientName").fill("E2E Client")
    await page.locator("#projectTitle").fill("E2E Project")
    await page.locator("#projectDescription").fill("A focused product brief for a deterministic browser journey.")
    await page.locator("#goals").fill("Validate generation, persistence, and editing.")
    await page.getByRole("button", { name: "Generate Proposal" }).click()

    await expect(page).toHaveURL(/\/proposal\/[a-f0-9]{24}$/)
    await expect(page.getByText("E2E Project Proposal", { exact: true })).toBeVisible()
    await expect(page.getByText("Completed", { exact: true })).toBeVisible()

    const proposalId = new URL(page.url()).pathname.split("/").pop()
    expect(proposalId).toMatch(/^[a-f0-9]{24}$/)
    const exportResponse = await page.request.get(`/api/export/proposal/${proposalId}?format=pdf`)
    expect(exportResponse.status()).toBe(200)
    expect(exportResponse.headers()["content-type"]).toContain("application/pdf")
    expect((await exportResponse.body()).subarray(0, 4).toString()).toBe("%PDF")

    const docxResponse = await page.request.get(`/api/export/proposal/${proposalId}?format=docx`)
    expect(docxResponse.status()).toBe(200)
    expect(docxResponse.headers()["content-type"]).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    expect((await docxResponse.body()).subarray(0, 4).toString()).toBe("PK\u0003\u0004")

    await page.getByRole("link", { name: "Edit", exact: true }).click()
    await expect(page).toHaveURL(/\/documents\/[a-f0-9]{24}\/edit$/)
    await page.locator("#project-title").fill("E2E Project Revised")
    await page.locator("#document-content").fill("# E2E Project Revised\n\nReviewed in the browser smoke journey.")
    await page.getByRole("button", { name: "Save changes" }).click()
    await expect(page.getByText("Saved", { exact: true })).toBeVisible()
    await expect(page.getByText("Version 1", { exact: true })).toBeVisible()

    await page.goto("/documents")
    await expect(page.getByText("E2E Project Revised", { exact: true })).toBeVisible()
    await page.getByLabel("Search documents").fill("E2E Project Revised")
    await expect(page.getByText("1 of 1 documents", { exact: true })).toBeVisible()

    await page.locator("select").first().selectOption("proposal")
    await expect(page.getByText("1 of 1 documents", { exact: true })).toBeVisible()
    await page.locator("select").first().selectOption("all")

    await page.getByRole("button", { name: "More document actions" }).click()
    await page.getByRole("menuitem", { name: "Duplicate" }).click()
    await expect(page.getByText("Document duplicated", { exact: true })).toBeVisible()
    await expect(page.getByText("2 of 2 documents", { exact: true })).toBeVisible()

    page.once("dialog", (dialog) => dialog.accept())
    await page.getByRole("button", { name: "More document actions" }).last().click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await expect(page.getByText("Document deleted", { exact: true })).toBeVisible()
    await expect(page.getByText("1 of 1 documents", { exact: true })).toBeVisible()
  })

  test("generates and renders a pitch deck", async ({ page }) => {
    await registerAndSignIn(page, "Deck")

    await page.goto("/generate/pitch-deck")
    await page.getByText("Technology & Software Development", { exact: true }).click()
    await page.getByLabel(/Company Name/).fill("E2E Startup")
    await page.getByLabel(/Problem Statement/).fill("Teams lose time creating consistent investor materials.")
    await page.getByLabel(/^Solution/).fill("A structured enterprise workspace for investor-ready documents.")
    await page.getByLabel(/Target Market/).fill("Founders and professional services teams.")
    await page.getByRole("button", { name: "Generate Pitch Deck" }).click()

    await expect(page).toHaveURL(/\/pitch-deck\/[a-f0-9]{24}$/)
    await expect(page.getByText("E2E Startup Pitch Deck", { exact: true })).toBeVisible()
    await expect(page.getByText("Company overview", { exact: true })).toBeVisible()
    await expect(page.getByText("Completed", { exact: true })).toBeVisible()

    const pitchDeckId = new URL(page.url()).pathname.split("/").pop()
    expect(pitchDeckId).toMatch(/^[a-f0-9]{24}$/)
    const exportResponse = await page.request.get(`/api/export/pitch-deck/${pitchDeckId}`)
    expect(exportResponse.status()).toBe(200)
    expect(exportResponse.headers()["content-type"]).toContain("application/pdf")
    expect((await exportResponse.body()).subarray(0, 4).toString()).toBe("%PDF")
  })

  test("does not expose another user's document", async ({ page, browser }) => {
    await registerAndSignIn(page, "OwnerIsolation")

    await page.goto("/generate/proposal")
    await page.getByText("Technology & Software Development", { exact: true }).click()
    await page.locator("#clientName").fill("Isolation Client")
    await page.locator("#projectTitle").fill("Private Ownership Check")
    await page.locator("#projectDescription").fill("A document that must remain visible only to its owner.")
    await page.locator("#goals").fill("Verify cross-user access boundaries.")
    await page.getByRole("button", { name: "Generate Proposal" }).click()

    await expect(page).toHaveURL(/\/proposal\/[a-f0-9]{24}$/)
    const proposalId = new URL(page.url()).pathname.split("/").pop()
    expect(proposalId).toMatch(/^[a-f0-9]{24}$/)

    const otherContext = await browser.newContext()
    const otherPage = await otherContext.newPage()

    try {
      await registerAndSignIn(otherPage, "OtherIsolation")

      const protectedResponse = await otherPage.goto(`/proposal/${proposalId}`)
      expect(protectedResponse?.status()).toBe(404)

      const exportResponse = await otherPage.request.get(`/api/export/proposal/${proposalId}?format=pdf`)
      expect(exportResponse.status()).toBe(404)

      const deleteResponse = await otherPage.request.delete(`/api/documents/${proposalId}`)
      expect(deleteResponse.status()).toBe(404)

      await otherPage.goto("/documents")
      await expect(otherPage.getByText("Private Ownership Check", { exact: true })).not.toBeVisible()
    } finally {
      await otherContext.close()
    }
  })

  test("enforces the free proposal generation limit", async ({ page }) => {
    await registerAndSignIn(page, "Quota")

    for (let index = 1; index <= 5; index += 1) {
      const response = await page.request.post("/api/generate/proposal", {
        data: {
          field: "technology",
          clientName: "Quota Client",
          projectTitle: `Quota Proposal ${index}`,
          projectDescription: "A deterministic generation used to verify monthly usage enforcement.",
          goals: "Verify the free-plan proposal limit.",
        },
      })

      expect(response.status()).toBe(200)
    }

    const blockedResponse = await page.request.post("/api/generate/proposal", {
      data: {
        field: "technology",
        clientName: "Quota Client",
        projectTitle: "Quota Proposal Blocked",
        projectDescription: "This request should be rejected after the free-plan limit is reached.",
        goals: "Verify the quota response.",
      },
    })

    expect(blockedResponse.status()).toBe(403)
    expect((await blockedResponse.json()).error).toContain("Usage limit reached")
  })
})
