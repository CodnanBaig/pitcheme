import { getSession } from "next-auth/react"

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
      console.log("Received 401, attempting to refresh session")

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
      throw new AuthApiError(`Request failed: ${response.statusText}`, response.status)
    }

    return response
  } catch (error) {
    if (error instanceof AuthApiError) {
      throw error
    }

    console.error("Network error:", error)
    throw new AuthApiError("Network error occurred", 500)
  }
}

export async function authenticatedJsonFetch<T = Record<string, unknown>>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await authenticatedFetch(url, options)
  return response.json()
}
