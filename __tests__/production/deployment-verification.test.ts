import { createServer, type Server } from "node:http"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") return reject(new Error("Unable to determine test port"))
      resolve(address.port)
    })
  })
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

const pageHeaders = {
  "Content-Type": "text/html",
  "X-Request-ID": "verify-test",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'",
}

function sendPage(response: import("node:http").ServerResponse, status: number, body: string) {
  response.writeHead(status, pageHeaders)
  response.end(body)
}

describe("deployment verification command", () => {
  it("rejects non-loopback HTTP deployment URLs before probing", async () => {
    await expect(execFileAsync(
      process.execPath,
      ["scripts/verify-deployment.mjs", "--url", "http://app.example.com"],
      { cwd: process.cwd() },
    )).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("non-loopback deployment URLs must use https"),
    })
  })

  it("passes healthy probes and validates build provenance", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/" || request.url === "/pricing") {
        sendPage(response, 200, "<html>enterprise landing</html>")
        return
      }

      if (request.url === "/__deployment-not-found-check__") {
        sendPage(response, 404, "<html>That workspace route is not available.</html>")
        return
      }

      if (request.url?.startsWith("/brand-lab")) {
        response.writeHead(404)
        response.end()
        return
      }

      const body = request.url === "/api/health/ready"
        ? {
            status: "healthy",
            requestId: "verify-test",
            build: { version: "0.1.0", commit: "abc123" },
            checks: {
              database: { status: "healthy" },
              ai_service: { status: "healthy" },
              storage: { status: "healthy" },
              export_runtime: { status: "healthy" },
              stripe: { status: "disabled" },
            },
            environment: { status: "valid" },
          }
        : { status: "healthy", requestId: "verify-test" }
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Request-ID": "verify-test",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy": "default-src 'self'",
      })
      response.end(JSON.stringify(body))
    })
    const port = await listen(server)

    try {
      const result = await execFileAsync(
        process.execPath,
        ["scripts/verify-deployment.mjs", "--url", `http://127.0.0.1:${port}`, "--expected-commit", "abc123", "--expect-brand-lab-disabled"],
        { cwd: process.cwd() },
      )
      expect(result.stdout).toContain('"status": "healthy"')
      expect(result.stdout).toContain('"commit": "abc123"')
      expect(result.stdout).toContain('"brandLab"')
      expect(result.stdout).toContain('"publicPages"')
      expect(result.stdout).toContain('"notFound"')
    } finally {
      await close(server)
    }
  })

  it("fails when the deployment does not expose build provenance", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/" || request.url === "/pricing") {
        sendPage(response, 200, "<html>enterprise landing</html>")
        return
      }

      if (request.url === "/__deployment-not-found-check__") {
        sendPage(response, 404, "<html>That workspace route is not available.</html>")
        return
      }

      const body = request.url === "/api/health/ready"
        ? {
            status: "healthy",
            requestId: "verify-test",
            build: { version: "0.1.0", commit: "unknown" },
            checks: {
              database: { status: "healthy" },
              ai_service: { status: "healthy" },
              storage: { status: "healthy" },
              export_runtime: { status: "healthy" },
              stripe: { status: "disabled" },
            },
            environment: { status: "valid" },
          }
        : { status: "healthy", requestId: "verify-test" }
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Request-ID": "verify-test",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy": "default-src 'self'",
      })
      response.end(JSON.stringify(body))
    })
    const port = await listen(server)

    try {
      await expect(execFileAsync(
        process.execPath,
        ["scripts/verify-deployment.mjs", "--url", `http://127.0.0.1:${port}`],
        { cwd: process.cwd() },
      )).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining("unverifiable build commit"),
      })
    } finally {
      await close(server)
    }
  })

  it("fails when a health probe redirects", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/api/health/live") {
        response.writeHead(302, { Location: "/api/health/ready" })
        response.end()
        return
      }

      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Request-ID": "verify-test",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy": "default-src 'self'",
      })
      response.end(JSON.stringify({ status: "healthy", requestId: "verify-test" }))
    })
    const port = await listen(server)

    try {
      await expect(execFileAsync(
        process.execPath,
        ["scripts/verify-deployment.mjs", "--url", `http://127.0.0.1:${port}`],
        { cwd: process.cwd() },
      )).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining("redirects are not allowed"),
      })
    } finally {
      await close(server)
    }
  })

  it("fails when the deployed commit does not match", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Request-ID": "verify-test",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy": "default-src 'self'",
      })
      response.end(JSON.stringify({
        status: "healthy",
        requestId: "verify-test",
        build: { version: "0.1.0", commit: "different" },
        checks: {
          database: { status: "healthy" },
          ai_service: { status: "healthy" },
          storage: { status: "healthy" },
          export_runtime: { status: "healthy" },
          stripe: { status: "disabled" },
        },
        environment: { status: "valid" },
      }))
    })
    const port = await listen(server)

    try {
      await expect(execFileAsync(
        process.execPath,
        ["scripts/verify-deployment.mjs", "--url", `http://127.0.0.1:${port}`, "--expected-commit", "abc123"],
        { cwd: process.cwd() },
      )).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining("expected abc123"),
      })
    } finally {
      await close(server)
    }
  })

  it("fails when the internal brand lab is exposed", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/" || request.url === "/pricing") {
        sendPage(response, 200, "<html>enterprise landing</html>")
        return
      }

      if (request.url === "/__deployment-not-found-check__") {
        sendPage(response, 404, "<html>That workspace route is not available.</html>")
        return
      }

      if (request.url === "/brand-lab/operator") {
        sendPage(response, 200, "<html>brand lab</html>")
        return
      }

      if (request.url?.startsWith("/brand-lab")) {
        response.writeHead(404)
        response.end()
        return
      }

      const body = request.url === "/api/health/ready"
        ? {
            status: "healthy",
            requestId: "verify-test",
            build: { version: "0.1.0", commit: "abc123" },
            checks: {
              database: { status: "healthy" },
              ai_service: { status: "healthy" },
              storage: { status: "healthy" },
              export_runtime: { status: "healthy" },
              stripe: { status: "disabled" },
            },
            environment: { status: "valid" },
          }
        : { status: "healthy", requestId: "verify-test" }
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Request-ID": "verify-test",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy": "default-src 'self'",
      })
      response.end(JSON.stringify(body))
    })
    const port = await listen(server)

    try {
      await expect(execFileAsync(
        process.execPath,
        ["scripts/verify-deployment.mjs", "--url", `http://127.0.0.1:${port}`, "--expect-brand-lab-disabled"],
        { cwd: process.cwd() },
      )).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining("/brand-lab/operator is exposed"),
      })
    } finally {
      await close(server)
    }
  })

  it("fails when the landing page exposes an internal brand-lab link", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/") {
        sendPage(response, 200, '<html><a href="/brand-lab">Visual directions</a></html>')
        return
      }

      if (request.url === "/pricing") {
        sendPage(response, 200, "<html>pricing</html>")
        return
      }

      if (request.url === "/__deployment-not-found-check__") {
        sendPage(response, 404, "<html>That workspace route is not available.</html>")
        return
      }

      if (request.url?.startsWith("/brand-lab")) {
        response.writeHead(404)
        response.end()
        return
      }

      const body = request.url === "/api/health/ready"
        ? {
            status: "healthy",
            requestId: "verify-test",
            build: { version: "0.1.0", commit: "abc123" },
            checks: {
              database: { status: "healthy" },
              ai_service: { status: "healthy" },
              storage: { status: "healthy" },
              export_runtime: { status: "healthy" },
              stripe: { status: "disabled" },
            },
            environment: { status: "valid" },
          }
        : { status: "healthy", requestId: "verify-test" }
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Request-ID": "verify-test",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy": "default-src 'self'",
      })
      response.end(JSON.stringify(body))
    })
    const port = await listen(server)

    try {
      await expect(execFileAsync(
        process.execPath,
        ["scripts/verify-deployment.mjs", "--url", `http://127.0.0.1:${port}`, "--expect-brand-lab-disabled"],
        { cwd: process.cwd() },
      )).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining("/ exposes an internal brand-lab link"),
      })
    } finally {
      await close(server)
    }
  })

  it("fails when the deployment is missing security headers", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Request-ID": "verify-test",
      })
      response.end(JSON.stringify({
        status: "healthy",
        requestId: "verify-test",
        build: { version: "0.1.0", commit: "abc123" },
      }))
    })
    const port = await listen(server)

    try {
      await expect(execFileAsync(
        process.execPath,
        ["scripts/verify-deployment.mjs", "--url", `http://127.0.0.1:${port}`],
        { cwd: process.cwd() },
      )).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining("x-content-type-options protection"),
      })
    } finally {
      await close(server)
    }
  })

  it("fails when readiness omits a critical dependency check", async () => {
    const server = createServer((request, response) => {
      const body = request.url === "/api/health/ready"
        ? {
            status: "healthy",
            requestId: "verify-test",
            build: { version: "0.1.0", commit: "abc123" },
            checks: {
              database: { status: "healthy" },
              ai_service: { status: "healthy" },
              storage: { status: "healthy" },
              export_runtime: { status: "disabled" },
              stripe: { status: "disabled" },
            },
            environment: { status: "valid" },
          }
        : { status: "healthy", requestId: "verify-test" }
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Request-ID": "verify-test",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy": "default-src 'self'",
      })
      response.end(JSON.stringify(body))
    })
    const port = await listen(server)

    try {
      await expect(execFileAsync(
        process.execPath,
        ["scripts/verify-deployment.mjs", "--url", `http://127.0.0.1:${port}`],
        { cwd: process.cwd() },
      )).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining("export_runtime as disabled"),
      })
    } finally {
      await close(server)
    }
  })

  it("fails closed on non-JSON probe responses", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, {
        "Content-Type": "text/html",
        "Cache-Control": "no-store",
      })
      response.end("<html>not the health API</html>")
    })
    const port = await listen(server)

    try {
      await expect(execFileAsync(
        process.execPath,
        ["scripts/verify-deployment.mjs", "--url", `http://127.0.0.1:${port}`],
        { cwd: process.cwd() },
      )).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining("non-JSON content type"),
      })
    } finally {
      await close(server)
    }
  })

  it("fails closed on oversized probe responses", async () => {
    const server = createServer((_request, response) => {
      const body = "x".repeat(256 * 1024 + 1)
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": String(body.length),
      })
      response.end(body)
    })
    const port = await listen(server)

    try {
      await expect(execFileAsync(
        process.execPath,
        ["scripts/verify-deployment.mjs", "--url", `http://127.0.0.1:${port}`],
        { cwd: process.cwd() },
      )).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining("oversized response"),
      })
    } finally {
      await close(server)
    }
  })
})
