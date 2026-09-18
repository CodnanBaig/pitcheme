import { escapeHtml, sanitizeGeneratedHtml } from "@/lib/sanitize-html"

describe("export HTML safety", () => {
  it("escapes text interpolated into generated markup", () => {
    expect(escapeHtml(`<script>alert("xss")</script>`))
      .toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;")
  })

  it("keeps safe slide structure and removes executable markup", () => {
    const safe = sanitizeGeneratedHtml(
      '<div class="slide"><h1>Title</h1><script>alert(1)</script><img src="x" onerror="alert(1)"></div>',
    )

    expect(safe).toContain('<div class="slide"><h1>Title</h1></div>')
    expect(safe).not.toContain("script")
    expect(safe).not.toContain("onerror")
  })
})
