#!/usr/bin/env node

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,96}$/
const DEFAULT_TIMEOUT_MS = 10_000
const MAX_PROBE_RESPONSE_BYTES = 256 * 1024
const BRAND_LAB_PROBE_PATHS = [
  "/brand-lab",
  "/brand-lab/signal",
  "/brand-lab/editorial",
  "/brand-lab/enterprise",
  "/brand-lab/operator",
]
const PUBLIC_PAGE_PROBE_PATHS = ["/", "/pricing"]
const NOT_FOUND_PROBE_PATH = "/__deployment-not-found-check__"

function optionValue(args, name) {
  const index = args.indexOf(name)
  if (index >= 0) return args[index + 1]
  const prefix = `${name}=`
  const inline = args.find((argument) => argument.startsWith(prefix))
  return inline ? inline.slice(prefix.length) : undefined
}

function endpointUrl(baseUrl, path) {
  const url = new URL(baseUrl)
  url.pathname = `${url.pathname.replace(/\/$/, "")}${path}`
  url.search = ""
  return url
}

function parseJson(path, raw) {
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`${path} returned a non-JSON response`)
  }
}

async function readBoundedResponseText(path, response) {
  const declaredLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROBE_RESPONSE_BYTES) {
    throw new Error(`${path} returned an oversized response`)
  }

  if (!response.body) return ""
  const reader = response.body.getReader()
  const chunks = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      totalBytes += value.byteLength
      if (totalBytes > MAX_PROBE_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined)
        throw new Error(`${path} returned an oversized response`)
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
  return new TextDecoder().decode(bytes)
}

function assertReadinessContract(path, body) {
  if (path !== "/api/health/ready") return

  const checks = body?.checks
  for (const name of ["database", "ai_service", "storage", "export_runtime"]) {
    if (checks?.[name]?.status !== "healthy") {
      throw new Error(`${path} reported ${name} as ${String(checks?.[name]?.status || "missing")}`)
    }
  }

  if (!checks?.stripe || !["healthy", "disabled"].includes(checks.stripe.status)) {
    throw new Error(`${path} reported stripe as ${String(checks?.stripe?.status || "missing")}`)
  }

  if (body?.environment?.status !== "valid") {
    throw new Error(`${path} reported an invalid runtime environment`)
  }
}

function assertBuildProvenance(build) {
  if (!build || typeof build !== "object") {
    throw new Error("readiness did not return build provenance")
  }

  for (const field of ["version", "commit"]) {
    const value = build[field]
    if (typeof value !== "string" || value.trim() === "" || value.trim().toLowerCase() === "unknown") {
      throw new Error(`readiness reported an unverifiable build ${field}`)
    }
  }
}

function assertRequestCorrelation(path, response) {
  const requestId = response.headers.get("x-request-id")
  if (!requestId || !REQUEST_ID_PATTERN.test(requestId)) {
    throw new Error(`${path} did not return a valid X-Request-ID header`)
  }
  return requestId
}

function assertSecurityHeaders(path, response, { requireNoStore = false } = {}) {
  if (requireNoStore && !response.headers.get("cache-control")?.toLowerCase().includes("no-store")) {
    throw new Error(`${path} is missing Cache-Control: no-store`)
  }

  const requiredHeaders = [
    ["x-content-type-options", "nosniff"],
    ["x-frame-options", "deny"],
    ["referrer-policy", "strict-origin-when-cross-origin"],
    ["permissions-policy", "camera=(), microphone=(), geolocation=()"],
  ]
  for (const [name, expected] of requiredHeaders) {
    if (response.headers.get(name)?.toLowerCase() !== expected) {
      throw new Error(`${path} is missing required ${name} protection`)
    }
  }

  if (!response.headers.get("content-security-policy")?.toLowerCase().includes("default-src 'self'")) {
    throw new Error(`${path} is missing a default-src Content-Security-Policy`)
  }

  if (new URL(response.url).protocol === "https:" && !response.headers.get("strict-transport-security")?.toLowerCase().includes("max-age=")) {
    throw new Error(`${path} is missing Strict-Transport-Security`)
  }
}

async function checkProbe(baseUrl, path, expectedStatus, expectedBodyStatus, timeoutMs) {
  const startedAt = Date.now()
  let response
  try {
    response = await fetch(endpointUrl(baseUrl, path), {
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw new Error(`${path} could not be reached: ${error instanceof Error ? error.message : "request failed"}`)
  }

  if (response.status >= 300 && response.status < 400) {
    throw new Error(`${path} returned HTTP ${response.status}; redirects are not allowed`)
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() || ""
  if (!contentType.includes("application/json")) {
    throw new Error(`${path} returned a non-JSON content type`)
  }
  const raw = await readBoundedResponseText(path, response)
  const body = parseJson(path, raw)
  const requestId = assertRequestCorrelation(path, response)
  if (response.status !== expectedStatus) {
    throw new Error(`${path} returned HTTP ${response.status}: ${typeof body?.checks === "object" ? JSON.stringify(body.checks) : body?.status || "unhealthy"}`)
  }
  if (body?.status !== expectedBodyStatus) {
    throw new Error(`${path} returned status ${String(body?.status)}`)
  }
  assertReadinessContract(path, body)
  if (body?.requestId !== requestId) {
    throw new Error(`${path} returned a mismatched request ID body/header`)
  }
  assertSecurityHeaders(path, response, { requireNoStore: true })

  return {
    path,
    status: response.status,
    requestId,
    responseTimeMs: Date.now() - startedAt,
    body,
  }
}

async function checkPublicPage(baseUrl, path, timeoutMs) {
  const startedAt = Date.now()
  let response
  try {
    response = await fetch(endpointUrl(baseUrl, path), {
      headers: { Accept: "text/html" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw new Error(`${path} could not be reached: ${error instanceof Error ? error.message : "request failed"}`)
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() || ""
  if (!contentType.includes("text/html")) {
    throw new Error(`${path} returned a non-HTML response`)
  }
  const html = await readBoundedResponseText(path, response)
  if (response.status !== 200) {
    throw new Error(`${path} returned HTTP ${response.status}`)
  }
  if (/Next\.js|Application error/i.test(html)) {
    throw new Error(`${path} returned framework-default error content`)
  }

  const requestId = assertRequestCorrelation(path, response)
  assertSecurityHeaders(path, response)
  return { path, status: response.status, requestId, responseTimeMs: Date.now() - startedAt }
}

async function checkNotFoundPage(baseUrl, timeoutMs) {
  const startedAt = Date.now()
  let response
  try {
    response = await fetch(endpointUrl(baseUrl, NOT_FOUND_PROBE_PATH), {
      headers: { Accept: "text/html" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw new Error(`${NOT_FOUND_PROBE_PATH} could not be reached: ${error instanceof Error ? error.message : "request failed"}`)
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() || ""
  if (!contentType.includes("text/html")) {
    throw new Error(`${NOT_FOUND_PROBE_PATH} returned a non-HTML response`)
  }
  const html = await readBoundedResponseText(NOT_FOUND_PROBE_PATH, response)
  if (response.status !== 404) {
    throw new Error(`${NOT_FOUND_PROBE_PATH} returned HTTP ${response.status}; expected a customer-safe 404`)
  }
  if (/Next\.js|Application error/i.test(html)) {
    throw new Error(`${NOT_FOUND_PROBE_PATH} returned framework-default error content`)
  }

  const requestId = assertRequestCorrelation(NOT_FOUND_PROBE_PATH, response)
  assertSecurityHeaders(NOT_FOUND_PROBE_PATH, response)
  return { path: NOT_FOUND_PROBE_PATH, status: response.status, requestId, responseTimeMs: Date.now() - startedAt }
}

async function checkBrandLabDisabled(baseUrl, timeoutMs) {
  const landingPath = "/"
  let landingResponse
  try {
    landingResponse = await fetch(endpointUrl(baseUrl, landingPath), {
      headers: { Accept: "text/html" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw new Error(`${landingPath} could not be reached: ${error instanceof Error ? error.message : "request failed"}`)
  }

  const landingContentType = landingResponse.headers.get("content-type")?.toLowerCase() || ""
  if (!landingContentType.includes("text/html")) {
    throw new Error(`${landingPath} returned a non-HTML response while checking customer navigation`)
  }
  const landingHtml = await readBoundedResponseText(landingPath, landingResponse)
  if (landingResponse.status !== 200) {
    throw new Error(`${landingPath} returned HTTP ${landingResponse.status} while checking customer navigation`)
  }
  if (landingHtml.includes("/brand-lab")) {
    throw new Error(`${landingPath} exposes an internal brand-lab link in the customer-facing deployment`)
  }

  const results = [{ path: landingPath, status: landingResponse.status }]
  for (const path of BRAND_LAB_PROBE_PATHS) {
    let response
    try {
      response = await fetch(endpointUrl(baseUrl, path), {
        headers: { Accept: "text/html" },
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      throw new Error(`${path} could not be reached: ${error instanceof Error ? error.message : "request failed"}`)
    }

    await response.body?.cancel().catch(() => undefined)
    if (response.status !== 404) {
      throw new Error(`${path} is exposed in the customer-facing deployment (HTTP ${response.status})`)
    }

    results.push({ path, status: response.status })
  }

  return results
}

function usage() {
  console.error("Usage: VERIFY_BASE_URL=https://app.example.com pnpm verify:deployment [--expected-commit <sha>] [--expected-version <version>] [--expect-brand-lab-disabled]")
}

function assertSecureDeploymentUrl(baseUrl) {
  if (baseUrl.protocol === "https:") return

  const hostname = baseUrl.hostname.replace(/^\[|\]$/g, "")
  if (["localhost", "127.0.0.1", "::1"].includes(hostname)) return

  throw new Error("non-loopback deployment URLs must use https")
}

const args = process.argv.slice(2)
const baseUrlValue = optionValue(args, "--url") || process.env.VERIFY_BASE_URL
const expectedCommit = optionValue(args, "--expected-commit") || process.env.EXPECTED_BUILD_SHA
const expectedVersion = optionValue(args, "--expected-version") || process.env.EXPECTED_APP_VERSION
const timeoutValue = optionValue(args, "--timeout-ms") || process.env.VERIFY_TIMEOUT_MS
const timeoutMs = timeoutValue ? Number(timeoutValue) : DEFAULT_TIMEOUT_MS
const expectBrandLabDisabled = args.includes("--expect-brand-lab-disabled") || process.env.VERIFY_BRAND_LAB_DISABLED === "true"

if (!baseUrlValue) {
  usage()
  process.exitCode = 2
} else if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
  console.error("Deployment verification failed: timeout must be a positive number of milliseconds")
  process.exitCode = 2
} else {
  try {
    const baseUrl = new URL(baseUrlValue)
    if (!/^https?:$/.test(baseUrl.protocol)) throw new Error("URL must use http or https")
    assertSecureDeploymentUrl(baseUrl)

    const probes = [
      await checkProbe(baseUrl, "/api/health/live", 200, "healthy", timeoutMs),
      await checkProbe(baseUrl, "/api/health/ready", 200, "healthy", timeoutMs),
    ]
    const readiness = probes[1].body
    const build = readiness?.build
    assertBuildProvenance(build)
    if (expectedCommit && build?.commit !== expectedCommit) {
      throw new Error(`readiness reported commit ${String(build?.commit)}; expected ${expectedCommit}`)
    }
    if (expectedVersion && build?.version !== expectedVersion) {
      throw new Error(`readiness reported version ${String(build?.version)}; expected ${expectedVersion}`)
    }

    const publicPages = []
    for (const path of PUBLIC_PAGE_PROBE_PATHS) {
      publicPages.push(await checkPublicPage(baseUrl, path, timeoutMs))
    }
    const notFound = await checkNotFoundPage(baseUrl, timeoutMs)

    const brandLab = expectBrandLabDisabled ? await checkBrandLabDisabled(baseUrl, timeoutMs) : undefined

    console.log(JSON.stringify({
      status: "healthy",
      baseUrl: baseUrl.origin,
      probes: probes.map(({ path, status, requestId, responseTimeMs }) => ({ path, status, requestId, responseTimeMs })),
      publicPages,
      notFound,
      ...(brandLab ? { brandLab } : {}),
      build: build || null,
    }, null, 2))
  } catch (error) {
    console.error(`Deployment verification failed: ${error instanceof Error ? error.message : "unknown error"}`)
    process.exitCode = 1
  }
}
