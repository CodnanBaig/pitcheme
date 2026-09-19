/** @jest-environment jsdom */

import { parsePitchDeckSlides, serializePitchDeckSlides } from "@/lib/pitch-deck-editor"

describe("pitch deck structured editor contract", () => {
  it("parses rendered slides into editable fields", () => {
    const slides = parsePitchDeckSlides(
      '<div class="slide"><h1>Problem</h1><ul><li>A costly gap</li><li>A slow workflow</li></ul><div class="visual-elements"><h3>Visual direction</h3><p>Use a restrained chart.</p></div><div class="speaker-notes"><h3>Speaker notes</h3><p>Explain the urgency.</p></div></div>',
    )

    expect(slides).toEqual([{
      title: "Problem",
      bullets: ["A costly gap", "A slow workflow"],
      visualSuggestion: "Use a restrained chart.",
      speakerNotes: "Explain the urgency.",
    }])
  })

  it("serializes edited fields through the safe enterprise slide markup", () => {
    const content = serializePitchDeckSlides([{
      title: "<Updated problem>",
      bullets: ["A <costly> gap"],
      visualSuggestion: "A chart & a callout",
      speakerNotes: "Keep the <story> focused.",
    }])

    expect(content).toContain("&lt;Updated problem&gt;")
    expect(content).toContain("A &lt;costly&gt; gap")
    expect(content).toContain("A chart &amp; a callout")
    expect(content).toContain('class="visual-elements"')
    expect(content).toContain('class="speaker-notes"')
  })

  it("leaves legacy text documents on the existing editor path", () => {
    expect(parsePitchDeckSlides("# Legacy pitch deck\n\n## Problem")).toBeNull()
  })
})
