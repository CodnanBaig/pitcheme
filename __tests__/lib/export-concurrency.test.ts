import { acquireExportConcurrencySlot } from "@/lib/export-concurrency"
import { resetConcurrencySlots } from "@/lib/concurrency-limit"

describe("document export concurrency guard", () => {
  beforeEach(() => resetConcurrencySlots())

  it("allows two exports across accounts but only one per account", () => {
    const first = acquireExportConcurrencySlot("user-1")
    const second = acquireExportConcurrencySlot("user-2")

    expect(first).toEqual(expect.any(Function))
    expect(second).toEqual(expect.any(Function))
    expect(acquireExportConcurrencySlot("user-1")).toBeNull()
    expect(acquireExportConcurrencySlot("user-3")).toBeNull()

    first?.()
    expect(acquireExportConcurrencySlot("user-3")).toEqual(expect.any(Function))
  })

  it("releases both account and process slots exactly once", () => {
    const release = acquireExportConcurrencySlot("user-1")
    release?.()
    release?.()

    expect(acquireExportConcurrencySlot("user-1")).toEqual(expect.any(Function))
  })
})
