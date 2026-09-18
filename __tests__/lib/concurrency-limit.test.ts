import { acquireConcurrencySlot, resetConcurrencySlots } from "@/lib/concurrency-limit"

describe("generation concurrency guard", () => {
  beforeEach(() => resetConcurrencySlots())

  it("allows one active slot and blocks a concurrent second request", () => {
    const release = acquireConcurrencySlot("user-1")
    expect(release).toEqual(expect.any(Function))
    expect(acquireConcurrencySlot("user-1")).toBeNull()

    release?.()
    expect(acquireConcurrencySlot("user-1")).toEqual(expect.any(Function))
  })

  it("makes release idempotent", () => {
    const release = acquireConcurrencySlot("user-1")
    release?.()
    release?.()
    expect(acquireConcurrencySlot("user-1")).toEqual(expect.any(Function))
  })
})
