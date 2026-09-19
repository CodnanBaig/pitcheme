describe("OpenRouter model configuration", () => {
  const modelEnvironment = [
    "OPENROUTER_PRIMARY_MODEL",
    "OPENROUTER_FALLBACK_MODEL",
    "OPENROUTER_LIGHTWEIGHT_MODEL",
    "OPENROUTER_VISUAL_MODEL",
  ] as const
  const originalEnvironment = Object.fromEntries(modelEnvironment.map((name) => [name, process.env[name]]))

  afterEach(() => {
    for (const name of modelEnvironment) {
      const original = originalEnvironment[name]
      if (original === undefined) delete process.env[name]
      else process.env[name] = original
    }
    jest.resetModules()
  })

  it("keeps the reviewed defaults when no overrides are configured", async () => {
    for (const name of modelEnvironment) delete process.env[name]
    jest.resetModules()
    const { selectModel } = await import("@/lib/openrouter")

    expect(selectModel()).toBe("qwen/qwen3.8-27b:free")
    expect(selectModel("fallback")).toBe("nvidia/nemotron-3-super-120b-a12b:free")
    expect(selectModel("lightweight")).toBe("liquid/lfm-2.5-2.6b:free")
    expect(selectModel("visual")).toBe("google/gemma-4-31b-it:free")
  })

  it("accepts bounded, non-whitespace model overrides", async () => {
    process.env.OPENROUTER_PRIMARY_MODEL = "openai/gpt-oss-20b"
    process.env.OPENROUTER_FALLBACK_MODEL = "google/gemini-2.5-flash"
    process.env.OPENROUTER_LIGHTWEIGHT_MODEL = "qwen/qwen3-8b"
    process.env.OPENROUTER_VISUAL_MODEL = "moonshotai/kimi-k2"
    jest.resetModules()
    const { selectModel } = await import("@/lib/openrouter")

    expect(selectModel()).toBe("openai/gpt-oss-20b")
    expect(selectModel("fallback")).toBe("google/gemini-2.5-flash")
    expect(selectModel("lightweight")).toBe("qwen/qwen3-8b")
    expect(selectModel("visual")).toBe("moonshotai/kimi-k2")
  })

  it("ignores unsafe or oversized overrides", async () => {
    process.env.OPENROUTER_PRIMARY_MODEL = "model with spaces"
    process.env.OPENROUTER_FALLBACK_MODEL = "x".repeat(161)
    jest.resetModules()
    const { selectModel } = await import("@/lib/openrouter")

    expect(selectModel()).toBe("qwen/qwen3.8-27b:free")
    expect(selectModel("fallback")).toBe("nvidia/nemotron-3-super-120b-a12b:free")
  })
})
