import { readJsonBody, readTextBody } from "@/lib/request-body"

describe("readJsonBody", () => {
  it("parses a bounded JSON request body", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ name: "Enterprise" }),
      headers: { "Content-Type": "application/json" },
    })

    await expect(readJsonBody(request, 1024)).resolves.toEqual({
      ok: true,
      body: { name: "Enterprise" },
    })
  })

  it("rejects invalid JSON without throwing", async () => {
    const request = new Request("http://localhost/api", { method: "POST", body: "not-json" })

    await expect(readJsonBody(request, 1024)).resolves.toEqual({ ok: false, reason: "invalid" })
  })

  it("rejects oversized bodies before parsing", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ payload: "x".repeat(256) }),
    })

    await expect(readJsonBody(request, 64)).resolves.toEqual({ ok: false, reason: "too-large" })
  })
})

describe("readTextBody", () => {
  it("reads a bounded UTF-8 request body", async () => {
    const request = new Request("http://localhost/api", { method: "POST", body: "signed payload" })

    await expect(readTextBody(request, 1024)).resolves.toEqual({ ok: true, body: "signed payload" })
  })

  it("rejects oversized streamed bodies", async () => {
    const request = new Request("http://localhost/api", { method: "POST", body: "x".repeat(128) })

    await expect(readTextBody(request, 64)).resolves.toEqual({ ok: false, reason: "too-large" })
  })
})
