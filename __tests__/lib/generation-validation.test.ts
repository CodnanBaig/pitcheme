import {
  normalizeGenerationBody,
  validateGenerationBody,
  validateGenerationBrief,
  validateGenerationOptions,
} from "@/lib/generation-validation"

describe("validateGenerationBody", () => {
  it("requires a JSON object and non-empty core fields", () => {
    expect(validateGenerationBody(null, ["clientName"])).toEqual({
      valid: false,
      errors: ["body must be a JSON object"],
    })
    expect(validateGenerationBody({ clientName: "  " }, ["clientName"])).toEqual({
      valid: false,
      errors: ["clientName is required"],
    })
  })

  it("rejects malformed field-specific data", () => {
    expect(validateGenerationBody({ clientName: "Acme", fieldSpecificData: [] }, ["clientName"])).toEqual({
      valid: false,
      errors: ["fieldSpecificData must be an object"],
    })
  })

  it("returns the original object when valid", () => {
    const body = { clientName: "Acme", fieldSpecificData: { market: "B2B" } }
    expect(validateGenerationBody(body, ["clientName"])).toEqual({ valid: true, data: body })
  })

  it("rejects oversized text and collection inputs", () => {
    expect(validateGenerationBody({ clientName: "x".repeat(10_001) }, ["clientName"])).toEqual({
      valid: false,
      errors: ["clientName must be 10000 characters or fewer"],
    })

    expect(validateGenerationBody({ clientName: "Acme", services: Array(51).fill("service") }, ["clientName"])).toEqual({
      valid: false,
      errors: ["services must contain 50 items or fewer"],
    })
  })

  it("rejects non-text field-specific values", () => {
    expect(validateGenerationBody({ clientName: "Acme", fieldSpecificData: { seats: 12 } }, ["clientName"])).toEqual({
      valid: false,
      errors: ["fieldSpecificData.seats must be a string or array of strings"],
    })

    expect(validateGenerationBody({ clientName: "Acme", fieldSpecificData: { regions: ["US", 12] } }, ["clientName"])).toEqual({
      valid: false,
      errors: ["fieldSpecificData.regions must contain only strings"],
    })
  })

  it("normalizes whitespace and removes empty optional values", () => {
    expect(normalizeGenerationBody({
      clientName: "  Acme  ",
      projectDescription: "line one\r\nline two",
      services: [" Consulting ", "", " Delivery "],
      fieldSpecificData: { market: " B2B ", empty: "  " },
    })).toEqual({
      clientName: "Acme",
      projectDescription: "line one\nline two",
      services: ["Consulting", "Delivery"],
      fieldSpecificData: { market: "B2B" },
    })
  })
})

describe("validateGenerationBrief", () => {
  it("rejects placeholder and underspecified proposal briefs", () => {
    expect(validateGenerationBrief({
      clientName: "Acme",
      projectDescription: "...",
      goals: "goals",
    }, "proposal")).toEqual([
      "projectDescription must contain meaningful information",
      "goals must contain at least 8 meaningful characters",
    ])
  })

  it("accepts a sufficiently detailed pitch brief", () => {
    expect(validateGenerationBrief({
      startupName: "Acme",
      problem: "Manual workflows slow enterprise teams",
      solution: "A secure workflow platform with audit trails",
      market: "Mid-market operations teams",
    }, "pitch-deck")).toEqual([])
  })
})

describe("validateGenerationOptions", () => {
  it("accepts supported generation options", () => {
    expect(validateGenerationOptions({
      field: "technology",
      modelPreference: "primary",
      visualMode: false,
      exportFormat: "html",
    }, "pitch-deck")).toEqual([])
  })

  it("rejects runtime-invalid options", () => {
    expect(validateGenerationOptions({
      field: "",
      modelPreference: "unknown",
      visualMode: "true",
      exportFormat: "docx",
    }, "pitch-deck")).toEqual([
      "field must be a non-empty string",
      "modelPreference is invalid",
      "visualMode must be a boolean",
      "exportFormat is invalid",
    ])
  })
})
