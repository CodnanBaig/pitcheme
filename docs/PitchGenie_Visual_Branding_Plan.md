# PitchGenie — Visual Design, UI/UX & Branding Plan

**Purpose:** Redesign PitchGenie so it looks like a modern, credible SaaS product rather than a generic AI-generated dashboard.

**Target impression:** Professional, calm, capable, technical, investor/business friendly, and immediately usable.

The visual system must support both sides of the product:

1. **AI generation** — intelligent, fast, modern.
2. **Business documents** — trustworthy, serious, polished.

---

# 1. Current Visual Problem Statement

The current UI has a functional SaaS structure, but the design language is still close to a standard Tailwind/Radix starter:

- generic cards
- generic badges
- repeated icon + title patterns
- limited visual hierarchy
- simplistic dashboard composition
- “AI-powered” visual cues that risk looking like template UI
- document-management actions that look available even when functionality is incomplete
- insufficient distinction between the proposal workflow and pitch-deck workflow
- no memorable brand system
- no clear product personality
- limited editorial/document-preview design
- little visual storytelling on the marketing page

The redesign should avoid common “AI slop” patterns:

- random purple/blue gradient everywhere
- glowing blobs
- excessive glassmorphism
- sparkle icons as the main identity
- giant generic “AI-powered” headlines
- excessive rounded cards
- every section floating in its own container
- arbitrary neon borders
- meaningless dashboard charts

---

# 2. Brand Strategy

PitchGenie should communicate:

**“Turn messy business context into clear, presentation-ready documents.”**

The product is not primarily “an AI chatbot.”

It is a **business-output workspace**.

### Brand attributes

- precise
- intelligent
- composed
- fast
- trustworthy
- modern
- quietly premium
- helpful without being playful
- creative without looking experimental

### Brand voice

Use language like:

- “Build the first draft in minutes.”
- “Turn your brief into a structured proposal.”
- “From idea to investor-ready narrative.”
- “Your business context, structured.”
- “Draft. Refine. Present.”

Avoid:

- “Magic”
- “Revolutionary AI”
- “10x your life”
- “AI that changes everything”
- excessive genie/lamp metaphors

The name can remain **PitchGenie**, but the visual identity should mature beyond the literal “genie” idea.

---

# 3. Branding Directions

Explore these four directions before implementation.

---

## Option A — Signal / Founder Intelligence

### Personality

Modern startup infrastructure with a premium strategy-tool feel.

### Visual language

- dark ink / graphite
- soft warm white
- electric indigo accent
- restrained lavender secondary
- sharp typography
- thin grid lines
- small data/AI status indicators
- minimal gradients

### Suggested palette

```text
Ink          #101114
Graphite     #1A1C21
Warm White   #F7F7F4
Mist         #ECEDE8
Indigo       #5B5CE2
Indigo Light #818CF8
Slate        #737987
Success      #2E8B57
Danger       #C94A4A
```

### Typography

- Primary: **Geist Sans** or **Inter**
- Display alternative: **Manrope**
- Monospace: **Geist Mono**

### Logo direction

Wordmark + simple signal mark:

- two converging lines becoming one
- abstract “P” built from document/presentation geometry
- subtle upward movement
- no lamp icon

### Strengths

- excellent for engineering/startup audience
- recruiter-friendly
- polished without looking corporate
- supports dark mode well

### Risk

Can feel similar to modern developer SaaS products if not given strong editorial layouts.

### Best use

**Recommended default direction.**

---

## Option B — Editorial / Strategic Studio

### Personality

Consulting studio + premium editorial document tool.

### Visual language

- cream background
- near-black typography
- deep forest or cobalt accent
- editorial whitespace
- thin rules
- strong typography
- fewer cards
- document previews treated like magazine covers

### Suggested palette

```text
Paper        #F5F2EA
Charcoal     #1C1C1A
Stone        #D9D4C8
Forest       #1F5A44
Cobalt       #3056D3
Muted Ink    #6D6A63
```

### Typography

- UI: **Instrument Sans**
- Display: **Fraunces**, **Source Serif 4**, or another restrained serif
- Mono: **IBM Plex Mono**

### Logo direction

Simple editorial wordmark:

**PITCHGENIE**

with distinctive spacing and a small geometric mark.

### Strengths

- premium and memorable
- proposal/document product feels very natural
- less likely to look like generic AI SaaS

### Risk

Requires careful design execution; poor typography can make it feel like a design portfolio instead of a software platform.

### Best use

Strong choice if the portfolio goal includes design maturity.

---

## Option C — Enterprise Intelligence

### Personality

Reliable enterprise workflow software.

### Visual language

- navy
- white
- cool gray
- cyan/teal accent
- dense but clear information architecture
- strong tables and navigation
- subtle depth
- fewer decorative elements

### Suggested palette

```text
Navy         #0D1B2A
Blue Slate   #1B263B
White        #FFFFFF
Cloud        #F4F6F8
Cyan         #18A6A6
Teal Dark    #0E7373
Text Muted   #667085
```

### Typography

- **Inter**
- **IBM Plex Sans**
- **Source Sans 3**

### Logo direction

Abstract document + intelligence grid.

### Strengths

- highest perceived trust
- works well for consultants and B2B sales teams
- clean dashboard potential

### Risk

Can become visually forgettable.

### Best use

If positioning PitchGenie as a serious B2B SaaS.

---

## Option D — Bold Operator

### Personality

Fast, modern, founder-first.

### Visual language

- black
- off-white
- vivid lime or orange accent
- oversized typography
- bold callouts
- less traditional SaaS framing

### Suggested palette

```text
Black        #0A0A0A
Off White    #F5F5F0
Lime         #B8F22B
Orange       #FF6B35
Steel        #7B7F87
```

### Typography

- **Space Grotesk**
- **Satoshi** where licensing permits
- **Inter** for body

### Logo direction

Condensed wordmark and arrow/forward mark.

### Strengths

- memorable
- energetic
- good founder/startup audience fit

### Risk

May feel too trendy for healthcare/consulting use.

### Best use

If PitchGenie is repositioned narrowly toward startup founders.

---

# 4. Recommended Brand Direction

Use a hybrid of:

**Option A — Signal / Founder Intelligence**

with the editorial restraint of:

**Option B — Strategic Studio**

This gives the project a distinct visual identity without sacrificing usability.

### Recommended final direction

#### Core colors

```text
Background     #F7F7F4
Surface        #FFFFFF
Primary Ink    #111318
Secondary Ink  #5D6470
Border         #E3E4DF
Primary        #5659E8
Primary Hover  #474BCB
Soft Primary   #EEEFFD
Success        #277A53
Warning        #A76B13
Danger         #B94040
Dark BG        #101114
```

### Typography

**UI:** Geist Sans  
**Display:** Manrope or Geist Sans in tighter display settings  
**Code / metadata:** Geist Mono

### Shape language

- radius 10–14px for UI surfaces
- radius 6–8px for inputs/buttons
- avoid pill-shaped everything
- avoid 20–30px “AI SaaS” radii

### Shadows

Use shadows sparingly.

Default cards should rely more on border + background separation than heavy shadow.

---

# 5. Logo & Identity Exploration

Create three logo concepts.

## Concept 1 — Convergence Mark

Two lines/blocks converge into a single forward line.

Meaning:

**messy ideas → structured pitch**

Use as primary option.

## Concept 2 — PG Document Mark

Geometric `P` and `G` created from stacked document/presentation panels.

Meaning:

**proposal + pitch deck**

## Concept 3 — Signal Spark

Not a literal sparkle.

Use a four-direction signal/anchor motif representing:

**insight → structure → output**

### Deliverables

- horizontal lockup
- icon-only
- dark version
- light version
- favicon
- social preview mark

### Checkpoint

Do not proceed to full UI implementation until one logo route and one primary brand palette are selected.

---

# 6. Information Architecture

Primary authenticated navigation:

```text
PitchGenie
├── Home / Dashboard
├── Create
│   ├── Proposal
│   └── Pitch Deck
├── Documents
├── Templates
├── Usage
└── Settings
```

Account menu:

- profile
- billing
- theme
- sign out

### Avoid

Putting every page in the top navigation.

Dashboard should feel like a workspace, not a marketing site.

---

# 7. Marketing Homepage Redesign

## Hero

Do not use a generic “AI-powered…” hero.

### Layout

Left:

- short eyebrow
- strong product statement
- concise support text
- CTA pair

Right:

- live product preview
- split between prompt/brief and generated document
- subtle motion showing transformation

### Suggested messaging

**Headline**

> Turn rough business context into documents people can act on.

**Support**

> Create structured proposals and investor-ready pitch decks, then refine, export and reuse them from one workspace.

### CTAs

Primary:

**Create a document**

Secondary:

**See how it works**

## Proof section

Use product behavior, not fake logos.

Examples:

- Structured generation
- Editable output
- Version history
- Export-ready
- Industry-aware
- Usage controls

## Workflow section

Show:

**Brief → Generate → Refine → Export**

Use one horizontally connected visual instead of four generic cards.

## Product preview

Show a real proposal or deck.

## Audience

Three use cases:

- founders
- consultants/agencies
- sales/business teams

## Final CTA

Minimal.

---

# 8. Authentication Screens

Current auth should be redesigned into a calm split layout.

### Desktop

Left 40%:

- brand
- short product promise
- subtle document preview

Right 60%:

- sign-in form
- minimal distractions

### Requirements

- password visibility toggle
- forgot password
- magic link state
- loading
- error
- success
- accessible labels

### Mobile

Single-column form.

No decorative full-screen illustration on small screens.

---

# 9. Dashboard Redesign

Current dashboard is functionally useful but visually generic.

### New layout

Top:

- greeting
- usage state
- primary create button

Then:

## Workspace strip

Two large creation tiles:

**New Proposal**  
**New Pitch Deck**

These should look distinct but related.

## Recent work

Use a table/list instead of repeated generic cards.

Columns:

- document
- type
- updated
- status
- actions

## Usage

Small horizontal meter:

```text
Proposals  3 / 5
Pitch Decks 1 / 3
```

## Remove

- fake “85% success rate”
- decorative statistics that do not help the user

### Optional meaningful metrics later

- documents created this month
- export count
- average generation time

---

# 10. Create Flow / Generation Wizard

This is one of the most important screens.

## Principle

Users should never face one giant form.

### Proposal flow

1. Industry
2. Client
3. Project
4. Scope
5. Commercials
6. Review brief
7. Generate

### Pitch deck flow

1. Industry
2. Company
3. Problem
4. Solution
5. Market
6. Traction/business model
7. Team/funding
8. Review brief
9. Generate

### Desktop

Two-column layout:

Left:
form/wizard

Right:
live brief summary

### Mobile

single column

sticky bottom action

### Progress

Use:

`3 of 7 — Project scope`

not only numbered circles.

### Form design

- labels always visible
- hints only where helpful
- useful examples
- clear required/optional status
- validation inline

---

# 11. Generation Experience

Replace generic spinner-only state.

### Full-screen generation canvas

Show staged progress:

- Understanding your brief
- Building narrative
- Drafting sections
- Checking consistency
- Finalizing

### Visual

Use a subtle progress line and document skeleton.

Do not show fake percentage unless it is based on real steps.

### Streaming

As structured sections become ready, render them progressively.

### Failure

Show:

- what failed
- retry
- switch model where appropriate
- preserve user input

---

# 12. Document Workspace

This should become PitchGenie’s strongest visual screen.

## Layout

### Left sidebar

Document outline.

For proposal:

- Executive Summary
- Objectives
- Scope
- Approach
- Timeline
- Pricing
- Risks
- Next Steps

For deck:

- slide thumbnails

### Center

Editable document canvas.

### Right panel

Contextual AI actions / metadata.

Examples:

- rewrite
- shorten
- expand
- change tone
- regenerate
- version history

### Top bar

- title
- autosave state
- share
- export
- overflow menu

### Canvas style

Proposal should resemble a professional document.

Pitch deck should resemble an actual presentation frame.

Do not render pitch decks as plain text.

---

# 13. Documents Library

Use a professional file-workspace pattern.

### View modes

Default: table/list.

Optional later: card grid.

### Columns

- Name
- Type
- Industry
- Updated
- Status
- Owner
- Actions

### Search

Instant search.

### Filters

- proposal / deck
- industry
- date
- status

### Empty state

Useful CTA.

### Row actions

- Open
- Duplicate
- Rename
- Export
- Delete

No dead controls.

---

# 14. Templates

Add only after the editor and document flow work.

### Proposal templates

- Software Project Proposal
- Consulting Proposal
- Retainer Proposal
- Healthcare Technology Proposal

### Pitch deck templates

- Pre-seed
- Seed
- SaaS
- Marketplace
- Healthcare

Templates should define:

- structure
- tone
- slide/section types
- visual theme

Do not create dozens.

---

# 15. Billing & Usage UI

Billing should look factual and transparent.

### `/pricing`

Use three plans only if all three make sense.

For employer-review prototype, Free + Pro is enough.

### Usage

Show:

- current plan
- proposal usage
- pitch-deck usage
- reset date

### Billing states

Design:

- active
- trial
- payment failed
- canceled
- canceling

---

# 16. Settings

Split into sections:

- Profile
- Appearance
- AI preferences
- Billing
- Data & Privacy

Avoid a single long card.

---

# 17. Design System

Create reusable tokens.

## Color tokens

```text
--bg
--surface
--surface-raised
--text-primary
--text-secondary
--border
--primary
--primary-hover
--primary-soft
--success
--warning
--danger
```

## Typography

Recommended scale:

```text
Display  48 / 54
H1       36 / 42
H2       28 / 34
H3       22 / 28
Body     16 / 24
Small    14 / 20
Meta     12 / 16
```

## Spacing

Use a consistent 4px system.

## Components

Create documented variants for:

- button
- input
- textarea
- select
- checkbox
- segmented control
- badge
- tooltip
- dropdown
- dialog
- command palette
- table
- empty state
- toast
- skeleton
- progress
- tabs
- sidebar
- document canvas
- slide thumbnail
- usage meter

---

# 18. Responsive Strategy

### Breakpoints

Design mobile-first.

Critical views:

- 375px
- 430px
- 768px
- 1024px
- 1440px

### Mobile rules

- collapse sidebar
- keep primary action reachable
- do not shrink document canvas impossibly
- use full-screen document editor mode
- export/actions go into overflow where needed
- create wizard gets sticky bottom navigation

### Checkpoint

No page should require horizontal scrolling at 375px except an intentionally zoomable document/presentation canvas.

---

# 19. Motion System

Motion should communicate state.

Use:

- 150–220ms UI transitions
- simple page fade/slide
- progress movement
- document-section reveal
- autosave status

Avoid:

- bouncing icons
- constant gradient animation
- floating particles
- large scroll-driven marketing animations

Respect `prefers-reduced-motion`.

---

# 20. Dark Mode

Dark mode should be supported but not required before the main visual system is stable.

Recommended:

- dark background: near-black, not pure black
- documents remain light “paper” surfaces where appropriate
- pitch deck themes can remain independent of app shell

---

# 21. Accessibility

Visual plan must include:

- contrast-safe palette
- 44px touch targets where practical
- visible focus ring
- keyboard navigation
- semantic forms
- non-color-only status indicators
- reduced motion
- clear destructive actions

---

# 22. Visual QA Checklist

Every major page must be reviewed at:

- 375×812
- 430×932
- 768×1024
- 1440×900

Check:

- spacing consistency
- text wrapping
- button hierarchy
- empty states
- loading states
- error states
- hover/focus states
- long document titles
- long user names
- long AI content
- no layout shift during generation

---

# 23. Visual Implementation Phases

## Visual Phase V0 — Direction Selection

- [ ] select brand route
- [ ] approve palette
- [ ] approve type system
- [ ] approve logo concept
- [ ] define tokens

**Checkpoint:** No full redesign before this is locked.

---

## Visual Phase V1 — Foundation

- [ ] global tokens
- [ ] typography
- [ ] buttons
- [ ] inputs
- [ ] cards/surfaces
- [ ] dialogs
- [ ] table
- [ ] badges
- [ ] responsive shell
- [ ] light/dark foundations

**Checkpoint:** Component page/storybook-style demo looks consistent.

---

## Visual Phase V2 — Marketing + Auth

- [ ] homepage
- [ ] pricing
- [ ] sign in
- [ ] sign up
- [ ] error/verify states

**Checkpoint:** Unauthenticated product experience feels intentional and polished.

---

## Visual Phase V3 — Workspace

- [ ] app shell
- [ ] dashboard
- [ ] documents table
- [ ] settings
- [ ] billing

**Checkpoint:** Navigation and daily-use pages feel like one coherent product.

---

## Visual Phase V4 — Generation Wizard

- [ ] proposal flow
- [ ] pitch-deck flow
- [ ] review step
- [ ] progress state
- [ ] error/retry state

**Checkpoint:** User can understand what to enter without explanation.

---

## Visual Phase V5 — Document Editor

- [ ] proposal canvas
- [ ] pitch-deck canvas
- [ ] outline/slide sidebar
- [ ] contextual AI panel
- [ ] autosave state
- [ ] version history
- [ ] export/share UI

**Checkpoint:** This becomes the signature screen of the product.

---

## Visual Phase V6 — Polish

- [ ] motion
- [ ] empty states
- [ ] skeletons
- [ ] mobile refinement
- [ ] contrast/accessibility
- [ ] error pages
- [ ] favicon
- [ ] social preview
- [ ] screenshot assets

**Checkpoint:** Product is ready for screenshots, README and résumé links.

---

# 24. Employer-Facing Visual Standard

Before sharing with employers, the app should pass this visual test:

- [ ] no generic starter-page feel
- [ ] no placeholder copy
- [ ] no dead buttons
- [ ] no fake charts
- [ ] no inconsistent radii
- [ ] no random gradients
- [ ] clear visual hierarchy
- [ ] consistent spacing
- [ ] clear mobile layout
- [ ] professional loading/error states
- [ ] proposal actually looks like a proposal
- [ ] pitch deck actually looks like a pitch deck
- [ ] screenshots look good without explanation
- [ ] product has a recognizable visual identity

---

# 25. Recommended Final Product Feel

PitchGenie should visually sit somewhere between:

- modern founder software
- a professional document workspace
- a lightweight strategy/consulting tool

It should **not** look like:

- a chatbot
- a generic admin dashboard
- a Canva clone
- a glowing “AI startup” landing page
- a template marketplace

The strongest visual story is:

> **A calm, intelligent workspace that takes messy business input and turns it into structured, presentation-ready output.**

That should guide every screen and every branding decision.
