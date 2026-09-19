/** @jest-environment node */

import { spawn } from "node:child_process"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import path from "node:path"
import modelConfiguration from "@/config/openrouter-models.json"

const defaultModels = Object.values(modelConfiguration).map(({ default: model }) => model)

type ProcessResult = {
  code: number | null
  stdout: string
  stderr: string
}

function runSmoke(environment: NodeJS.ProcessEnv, args: string[] = []): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), "scripts/smoke-openrouter.mjs"), ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPENROUTER_PRIMARY_MODEL: "",
        OPENROUTER_FALLBACK_MODEL: "",
        OPENROUTER_LIGHTWEIGHT_MODEL: "",
        OPENROUTER_VISUAL_MODEL: "",
        ...environment,
      },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => { stdout += String(chunk) })
    child.stderr.on("data", (chunk) => { stderr += String(chunk) })
    child.on("error", reject)
    child.on("close", (code) => resolve({ code, stdout, stderr }))
  })
}

async function withProvider(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
  run: (baseUrl: string) => Promise<void>,
) {
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Expected a TCP test server")
  try {
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

describe("real-provider smoke command", () => {
  it("fails before network access when the provider key is missing", async () => {
    const result = await runSmoke({ OPENROUTER_API_KEY: "", OPENROUTER_SMOKE_TEST_BASE_URL: "" })

    expect(result.code).toBe(1)
    expect(result.stderr).toContain("OPENROUTER_API_KEY is required")
  })

  it("checks every configured role and performs a bounded primary generation", async () => {
    const requests: Array<{ method?: string; url?: string; authorization?: string; body: string }> = []
    await withProvider((request, response) => {
      let body = ""
      request.on("data", (chunk) => { body += String(chunk) })
      request.on("end", () => {
        requests.push({
          method: request.method,
          url: request.url,
          authorization: request.headers.authorization,
          body,
        })
        response.setHeader("Content-Type", "application/json")
        if (request.url === "/models") {
          response.end(JSON.stringify({ data: defaultModels.map((id) => ({ id })) }))
          return
        }
        response.end(JSON.stringify({
          model: defaultModels[0],
          choices: [{ message: { content: "PITCHGENIE_OK" } }],
          usage: { total_tokens: 7 },
        }))
      })
    }, async (baseUrl) => {
      const result = await runSmoke({
        OPENROUTER_API_KEY: "provider-test-secret",
        OPENROUTER_SMOKE_TEST_BASE_URL: baseUrl,
      })

      expect(result).toMatchObject({ code: 0, stderr: "" })
      expect(result.stdout).not.toContain("provider-test-secret")
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: "healthy",
        catalogRoles: ["primary", "fallback", "lightweight", "visual"],
        generations: [{ role: "primary", totalTokens: 7 }],
      })
    })

    expect(requests).toHaveLength(2)
    expect(requests.every((request) => request.authorization === "Bearer provider-test-secret")).toBe(true)
    expect(requests[0]).toMatchObject({ method: "GET", url: "/models" })
    expect(JSON.parse(requests[1].body)).toMatchObject({
      model: defaultModels[0],
      temperature: 0,
      max_tokens: 32,
    })
  })

  it("does not echo provider error bodies or credentials", async () => {
    await withProvider((_request, response) => {
      response.statusCode = 401
      response.setHeader("Content-Type", "application/json")
      response.end(JSON.stringify({ error: "provider-test-secret must never be printed" }))
    }, async (baseUrl) => {
      const result = await runSmoke({
        OPENROUTER_API_KEY: "provider-test-secret",
        OPENROUTER_SMOKE_TEST_BASE_URL: baseUrl,
      })

      expect(result.code).toBe(1)
      expect(result.stderr).toContain("HTTP 401")
      expect(`${result.stdout}${result.stderr}`).not.toContain("provider-test-secret")
      expect(`${result.stdout}${result.stderr}`).not.toContain("must never be printed")
    })
  })

  it("can exercise every unique configured model explicitly", async () => {
    let completionCount = 0
    await withProvider((request, response) => {
      response.setHeader("Content-Type", "application/json")
      if (request.url === "/models") {
        response.end(JSON.stringify({ data: defaultModels.map((id) => ({ id })) }))
        return
      }

      let body = ""
      request.on("data", (chunk) => { body += String(chunk) })
      request.on("end", () => {
        completionCount += 1
        const requestedModel = JSON.parse(body).model
        response.end(JSON.stringify({
          model: requestedModel,
          choices: [{ message: { content: "PITCHGENIE_OK" } }],
        }))
      })
    }, async (baseUrl) => {
      const result = await runSmoke({
        OPENROUTER_API_KEY: "provider-test-secret",
        OPENROUTER_SMOKE_TEST_BASE_URL: baseUrl,
      }, ["--all-models"])

      expect(result.code).toBe(0)
      expect(JSON.parse(result.stdout).generations.map((generation: { role: string }) => generation.role)).toEqual([
        "primary",
        "fallback",
        "lightweight",
        "visual",
      ])
    })

    expect(completionCount).toBe(4)
  })
})
