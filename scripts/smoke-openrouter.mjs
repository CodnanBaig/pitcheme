#!/usr/bin/env node

import fs from "node:fs"

const PROVIDER_BASE_URL = "https://openrouter.ai/api/v1"
const CATALOG_RESPONSE_LIMIT_BYTES = 1024 * 1024
const COMPLETION_RESPONSE_LIMIT_BYTES = 256 * 1024
const REQUEST_TIMEOUT_MS = 15_000
const SENTINEL = "PITCHGENIE_OK"

const modelConfiguration = JSON.parse(
  fs.readFileSync(new URL("../config/openrouter-models.json", import.meta.url), "utf8"),
)

function configuredModels() {
  return Object.fromEntries(Object.entries(modelConfiguration).map(([role, config]) => {
    const value = process.env[config.environment]?.trim()
    if (value && (value.length > 160 || /\s/.test(value))) {
      throw new Error(`${config.environment} must be a non-whitespace model identifier of 160 characters or fewer`)
    }
    return [role, value || config.default]
  }))
}

function providerBaseUrl() {
  const testUrl = process.env.OPENROUTER_SMOKE_TEST_BASE_URL?.trim()
  if (!testUrl) return PROVIDER_BASE_URL

  const url = new URL(testUrl)
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    throw new Error("OPENROUTER_SMOKE_TEST_BASE_URL must be a loopback HTTP URL")
  }
  return url.toString().replace(/\/$/, "")
}

async function readBoundedJson(response, limitBytes) {
  const declaredLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > limitBytes) {
    throw new Error("Provider response exceeded the smoke-test size limit")
  }
  if (!response.body) throw new Error("Provider returned an empty response")

  const reader = response.body.getReader()
  const chunks = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      totalBytes += value.byteLength
      if (totalBytes > limitBytes) {
        await reader.cancel().catch(() => undefined)
        throw new Error("Provider response exceeded the smoke-test size limit")
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error("Provider returned invalid JSON")
  }
}

async function requestJson(url, init, limitBytes, operation) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
    })
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined)
      throw new Error(`${operation} failed with HTTP ${response.status}`)
    }
    return await readBoundedJson(response, limitBytes)
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`${operation} timed out after ${REQUEST_TIMEOUT_MS}ms`)
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function providerHeaders(apiKey) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Title": "PitchGenie provider smoke",
  }
  const applicationUrl = process.env.NEXTAUTH_URL?.trim()
  if (applicationUrl) {
    try {
      const url = new URL(applicationUrl)
      if (url.protocol === "http:" || url.protocol === "https:") headers["HTTP-Referer"] = url.origin
    } catch {
      // Runtime validation reports malformed NEXTAUTH_URL separately. The
      // provider smoke remains focused on the provider contract.
    }
  }
  return headers
}

async function verifyCatalog(baseUrl, headers, models) {
  const payload = await requestJson(
    `${baseUrl}/models`,
    { headers },
    CATALOG_RESPONSE_LIMIT_BYTES,
    "Provider model-catalog request",
  )
  const available = new Set(
    Array.isArray(payload?.data)
      ? payload.data.map((model) => model?.id).filter((id) => typeof id === "string")
      : [],
  )
  const missing = Object.entries(models)
    .filter(([, model]) => !available.has(model))
    .map(([role]) => role)
  if (missing.length > 0) {
    throw new Error(`Provider model catalog is missing configured role(s): ${missing.join(", ")}`)
  }
}

async function verifyGeneration(baseUrl, headers, role, model) {
  const startedAt = Date.now()
  const payload = await requestJson(
    `${baseUrl}/chat/completions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 32,
        messages: [
          {
            role: "system",
            content: `Return exactly ${SENTINEL} and no other text.`,
          },
          {
            role: "user",
            content: "Confirm that the text-generation path is available.",
          },
        ],
      }),
    },
    COMPLETION_RESPONSE_LIMIT_BYTES,
    `Provider generation for ${role}`,
  )

  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== "string" || !content.includes(SENTINEL)) {
    throw new Error(`Provider generation for ${role} did not return the smoke-test sentinel`)
  }

  return {
    role,
    requestedModel: model,
    responseModel: typeof payload?.model === "string" ? payload.model : model,
    totalTokens: Number.isFinite(payload?.usage?.total_tokens) ? payload.usage.total_tokens : null,
    durationMs: Date.now() - startedAt,
  }
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log("Usage: pnpm smoke:provider [-- --all-models]")
    console.log("Validates the configured OpenRouter catalog and performs a minimal real generation.")
    return
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required")

  const models = configuredModels()
  const baseUrl = providerBaseUrl()
  const headers = providerHeaders(apiKey)
  await verifyCatalog(baseUrl, headers, models)

  const requestedRoles = process.argv.includes("--all-models")
    ? Object.keys(models)
    : ["primary"]
  const uniqueModels = new Set()
  const results = []
  for (const role of requestedRoles) {
    const model = models[role]
    if (uniqueModels.has(model)) continue
    uniqueModels.add(model)
    results.push(await verifyGeneration(baseUrl, headers, role, model))
  }

  console.log(JSON.stringify({
    status: "healthy",
    catalogRoles: Object.keys(models),
    generations: results,
  }))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown provider smoke failure"
  console.error(`OpenRouter provider smoke failed: ${message}`)
  process.exitCode = 1
})
