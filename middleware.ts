import { NextResponse } from "next/server"

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,96}$/
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

function isCsrfExempt(pathname: string): boolean {
  // NextAuth owns its callback CSRF contract, and Stripe signs webhook bodies
  // independently of browser-origin headers.
  return pathname.startsWith("/api/auth/") && pathname !== "/api/auth/register"
    || pathname === "/api/stripe/webhook"
}

function isSameOrigin(request: Request, candidate: string): boolean {
  try {
    const candidateOrigin = new URL(candidate).origin
    const trustedOrigins = new Set<string>([new URL(request.url).origin])
    const configuredOrigin = process.env.NEXTAUTH_URL?.trim()
    if (configuredOrigin) trustedOrigins.add(new URL(configuredOrigin).origin)
    return trustedOrigins.has(candidateOrigin)
  } catch {
    return false
  }
}

function hasTrustedBrowserOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")?.trim()
  if (origin) return isSameOrigin(request, origin)

  const referer = request.headers.get("referer")?.trim()
  return !referer || isSameOrigin(request, referer)
}

/**
 * Give every application request a bounded correlation ID, including
 * framework-owned routes such as NextAuth and server-rendered pages that do
 * not pass through a local route handler. Route handlers keep the incoming
 * value and expose it on their response.
 */
export function middleware(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim()
  const requestId = supplied && REQUEST_ID_PATTERN.test(supplied)
    ? supplied
    : crypto.randomUUID()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-request-id", requestId)

  const pathname = new URL(request.url).pathname
  if (
    pathname.startsWith("/api/")
    && STATE_CHANGING_METHODS.has(request.method.toUpperCase())
    && !isCsrfExempt(pathname)
    && !hasTrustedBrowserOrigin(request)
  ) {
    const headers = new Headers({
      "Cache-Control": "no-store",
      "X-Request-ID": requestId,
    })
    return NextResponse.json(
      { error: "Cross-origin request rejected", requestId },
      { status: 403, headers },
    )
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set("X-Request-ID", requestId)
  return response
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
}
