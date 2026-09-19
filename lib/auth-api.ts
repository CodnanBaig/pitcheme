import { getSession } from "next-auth/react"
import { readBoundedJsonResponse } from "@/lib/bounded-json"

const MAX_AUTH_ERROR_RESPONSE_BYTES = 64 * 1024
const MAX_AUTH_JSON_RESPONSE_BYTES = 2 * 1024 * 1024

export class AuthApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = "AuthApiError"
  }
}

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get the current session
  const session = await getSession()

  if (!session) {
    throw new AuthApiError("No active session", 401)
  }

  // Set default headers including credentials
  const defaultHeaders = {
    "Content-Type": "application/json",
    ...options.headers,
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: defaultHeaders,
      credentials: "include", // Include cookies for session
    })

    // If we get a 401, try to refresh the session
    if (response.status === 401) {
      // Try to refresh the session
      const refreshResponse = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include",
      })

      if (refreshResponse.ok) {
        // Retry the original request after session refresh
        const retryResponse = await fetch(url, {
          ...options,
          headers: defaultHeaders,
          credentials: "include",
        })

        if (retryResponse.ok) {
          return retryResponse
        }
      }

      throw new AuthApiError("Authentication failed after refresh", 401)
    }

    if (!response.ok) {
      let message = `Request failed: ${response.statusText || response.status}`
      try {
        const payload = await readBoundedJsonResponse(response, MAX_AUTH_ERROR_RESPONSE_BYTES) as { error?: unknown; fields?: unknown }
        const fieldError = Array.isArray(payload.fields) && typeof payload.fields[0] === "string"
          ? payload.fields[0]
          : undefined
        if (fieldError) message = fieldError
        else if (typeof payload.error === "string") message = payload.error
      } catch {
        // Preserve the status-based message when the server did not return JSON.
      }
      throw new AuthApiError(message, response.status)
    }

    return response
  } catch (error) {
    if (error instanceof AuthApiError) {
      throw error
    }

    throw new AuthApiError("Network error occurred", 500)
  }
}

export async function authenticatedJsonFetch<T = Record<string, unknown>>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await authenticatedFetch(url, options)
  return await readBoundedJsonResponse(response, MAX_AUTH_JSON_RESPONSE_BYTES) as T
}
