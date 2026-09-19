import { parseMarkdownTableBlock } from "@/lib/markdown-table"

describe("markdown table parsing", () => {
  it("parses bounded tables and identifies pricing columns", () => {
    const result = parseMarkdownTableBlock([
      "| Deliverable | Timeline | Price |",
      "| --- | :---: | ---: |",
      "| Discovery | 2 weeks | $5,000 |",
      "| Delivery | 6 weeks | $25,000 |",
      "",
      "## Terms",
    ], 0)

    expect(result).toEqual({
      nextIndex: 4,
      table: {
        headers: ["Deliverable", "Timeline", "Price"],
        rows: [
          ["Discovery", "2 weeks", "$5,000"],
          ["Delivery", "6 weeks", "$25,000"],
        ],
        pricing: true,
      },
    })
  })

  it("leaves incomplete table-looking content alone", () => {
    expect(parseMarkdownTableBlock(["| Deliverable | Price |", "not a separator"], 0)).toBeNull()
  })

  it("supports escaped pipes inside cells", () => {
    const result = parseMarkdownTableBlock([
      "Name | Scope",
      "--- | ---",
      "Platform | API \\| dashboard (C:\\tools)",
    ], 0)

    expect(result?.table.rows[0]).toEqual(["Platform", "API | dashboard (C:\\tools)"])
  })
})
