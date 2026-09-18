import Link from "next/link"
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  CircleDot,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  PanelLeft,
  Presentation,
  Search,
  Settings2,
  Sparkles,
  Table2,
  Users,
  WandSparkles,
} from "lucide-react"

export const brandOptions = [
  {
    slug: "signal",
    letter: "A",
    name: "Signal",
    descriptor: "Founder intelligence",
    summary:
      "A sharp, quietly technical workspace for founders who need a confident first draft and a clear next move.",
    fit: "Best for startup and product-led audiences",
    palette: ["#101114", "#1A1C21", "#F7F7F4", "#5B5CE2"],
    type: "Geist Sans / Manrope",
  },
  {
    slug: "editorial",
    letter: "B",
    name: "Editorial",
    descriptor: "Strategic studio",
    summary:
      "A considered document studio where the proposal itself is the hero and every decision has room to breathe.",
    fit: "Best for consultants and premium client work",
    palette: ["#F5F2EA", "#1C1C1A", "#1F5A44", "#3056D3"],
    type: "Instrument Sans / Fraunces",
  },
  {
    slug: "enterprise",
    letter: "C",
    name: "Enterprise",
    descriptor: "Workflow intelligence",
    summary:
      "A dependable operating surface for teams that care about ownership, review trails, and predictable output.",
    fit: "Best for sales and business teams",
    palette: ["#0D1B2A", "#1B263B", "#FFFFFF", "#18A6A6"],
    type: "Inter / IBM Plex Sans",
  },
  {
    slug: "operator",
    letter: "D",
    name: "Operator",
    descriptor: "Founder velocity",
    summary:
      "A high-contrast, energetic direction for teams who want the product to feel as decisive as the pitch they are making.",
    fit: "Best for an early-stage founder focus",
    palette: ["#0A0A0A", "#F5F5F0", "#B8F22B", "#FF6B35"],
    type: "Space Grotesk / Inter",
  },
] as const

export type BrandOptionSlug = (typeof brandOptions)[number]["slug"]

export function getBrandOption(slug: string) {
  return brandOptions.find((option) => option.slug === slug)
}

function Mark({ variant }: { variant: BrandOptionSlug }) {
  if (variant === "editorial") {
    return <span className="brand-mark brand-mark-editorial">P</span>
  }

  if (variant === "enterprise") {
    return (
      <span className="brand-mark brand-mark-enterprise" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    )
  }

  if (variant === "operator") {
    return <span className="brand-mark brand-mark-operator">↗</span>
  }

  return (
    <span className="brand-mark brand-mark-signal" aria-hidden="true">
      <span />
      <span />
    </span>
  )
}

function BrandLogo({ variant, compact = false }: { variant: BrandOptionSlug; compact?: boolean }) {
  return (
    <span className={`brand-logo ${compact ? "brand-logo-compact" : ""}`}>
      <Mark variant={variant} />
      <span>
        <strong>PITCHGENIE</strong>
        {!compact && <small>business output workspace</small>}
      </span>
    </span>
  )
}

function VariantPreview({ variant }: { variant: BrandOptionSlug }) {
  if (variant === "editorial") {
    return (
      <div className="option-preview preview-editorial" aria-label="Editorial direction preview">
        <div className="editorial-preview-bar">
          <BrandLogo variant="editorial" compact />
          <span>Workspace / 04</span>
        </div>
        <div className="editorial-preview-content">
          <div className="editorial-preview-kicker">Client proposal / draft 02</div>
          <h2>Northline<br />growth plan</h2>
          <div className="editorial-preview-rule" />
          <div className="editorial-preview-columns">
            <p>
              A clearer route from the first conversation to a proposal your client can act on.
            </p>
            <div className="editorial-preview-note">
              <span>Prepared for</span>
              <strong>Northline Studio</strong>
              <span>12 September 2026</span>
            </div>
          </div>
          <div className="editorial-preview-footer">
            <span>01 / 08</span>
            <span>PitchGenie</span>
          </div>
        </div>
      </div>
    )
  }

  if (variant === "enterprise") {
    return (
      <div className="option-preview preview-enterprise" aria-label="Enterprise direction preview">
        <aside className="enterprise-preview-nav">
          <BrandLogo variant="enterprise" compact />
          <span className="enterprise-nav-label">Workspace</span>
          <span className="enterprise-nav-item enterprise-nav-item-active"><LayoutDashboard /> Overview</span>
          <span className="enterprise-nav-item"><Table2 /> Documents</span>
          <span className="enterprise-nav-item"><Users /> Team</span>
          <span className="enterprise-nav-item"><BarChart3 /> Usage</span>
          <span className="enterprise-nav-item enterprise-nav-bottom"><Settings2 /> Settings</span>
        </aside>
        <div className="enterprise-preview-main">
          <div className="enterprise-preview-topbar">
            <div><Menu /><span>Monday, 14 September</span></div>
            <div><Search /><span>Search workspace</span><CircleDot /></div>
          </div>
          <div className="enterprise-preview-heading">
            <div><span className="enterprise-preview-label">OVERVIEW</span><h2>Good morning, Amina</h2></div>
            <span className="enterprise-preview-button"><Sparkles /> New document</span>
          </div>
          <div className="enterprise-preview-strip" aria-label="Illustrative workspace states">
            <div><span>Review queue</span><strong>Active</strong><small>Illustrative state</small></div>
            <div><span>Next handoff</span><strong>Queued</strong><small>Illustrative state</small></div>
            <div><span>Capacity signal</span><strong>On track</strong><small>Illustrative state</small></div>
          </div>
          <div className="enterprise-preview-table">
            <div className="enterprise-table-head"><span>RECENT DOCUMENTS</span><span>STATUS</span><span>OWNER</span><span /></div>
            <div className="enterprise-table-row"><FileText /><strong>Northline growth plan</strong><span className="status status-review">In review</span><span>Amina</span><MoreHorizontal /></div>
            <div className="enterprise-table-row"><Presentation /><strong>Meridian seed deck</strong><span className="status status-ready">Ready</span><span>Jon</span><MoreHorizontal /></div>
            <div className="enterprise-table-row"><FileText /><strong>Q4 partner proposal</strong><span className="status status-draft">Draft</span><span>Rhea</span><MoreHorizontal /></div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === "operator") {
    return (
      <div className="option-preview preview-operator" aria-label="Operator direction preview">
        <div className="operator-preview-topbar">
          <BrandLogo variant="operator" compact />
          <span>02 / 04</span>
          <span>Draft room <ArrowUpRight /></span>
        </div>
        <div className="operator-preview-body">
          <div className="operator-preview-heading">
            <span className="operator-preview-label">TURN CONTEXT INTO MOMENTUM</span>
            <h2>Make the<br /><em>next draft</em> obvious.</h2>
            <p>Paste the messy version. PitchGenie finds the signal, gives it shape, and leaves you with a document you can stand behind.</p>
          </div>
          <div className="operator-preview-flow">
            <div><span>01</span><strong>Raw brief</strong><small>2,400 words</small></div>
            <ChevronRight />
            <div className="operator-flow-active"><span>02</span><strong>Clear story</strong><small>Proposal / ready</small></div>
            <ChevronRight />
            <div><span>03</span><strong>Send it</strong><small>PDF + DOCX</small></div>
          </div>
        </div>
        <div className="operator-preview-footer"><span><span className="operator-dot" /> Generation ready</span><span>⌘ ↵ to create</span></div>
      </div>
    )
  }

  return (
    <div className="option-preview preview-signal" aria-label="Signal direction preview">
      <div className="signal-preview-topbar">
        <BrandLogo variant="signal" compact />
        <div><span className="signal-status-dot" /> All systems clear <span className="signal-avatar">AS</span></div>
      </div>
      <div className="signal-preview-body">
        <aside className="signal-preview-nav">
          <span className="signal-nav-title">WORKSPACE</span>
          <span className="signal-nav-item signal-nav-active"><PanelLeft /> Overview</span>
          <span className="signal-nav-item"><FolderOpen /> Documents</span>
          <span className="signal-nav-item"><WandSparkles /> Create</span>
          <span className="signal-nav-item"><Settings2 /> Settings</span>
          <div className="signal-nav-note"><span>WORKFLOW SIGNAL</span><strong>In motion</strong><div aria-hidden="true"><i style={{ width: "70%" }} /></div><small>Illustrative state</small></div>
        </aside>
        <div className="signal-preview-content">
          <div className="signal-greeting"><span>MONDAY / 14 SEPTEMBER 2026</span><h2>Make the next move clear.</h2><p>Your workspace is ready for another strong first draft.</p></div>
          <div className="signal-action-row"><div><span className="signal-action-icon"><FileText /></span><strong>New proposal</strong><small>Scope, approach, investment</small></div><div><span className="signal-action-icon signal-action-purple"><Presentation /></span><strong>New pitch deck</strong><small>Story, market, traction</small></div></div>
          <div className="signal-recent"><div className="signal-section-heading"><span>RECENT OUTPUT</span><span className="signal-view-all">View all <ArrowUpRight /></span></div><div className="signal-document-row"><span className="signal-doc-mark">N</span><div><strong>Northline growth plan</strong><small>Proposal · Edited 18 min ago</small></div><span className="signal-doc-state">Draft</span><MoreHorizontal /></div><div className="signal-document-row"><span className="signal-doc-mark signal-doc-mark-purple">M</span><div><strong>Meridian seed deck</strong><small>Pitch deck · Edited yesterday</small></div><span className="signal-doc-state signal-doc-state-ready">Ready</span><MoreHorizontal /></div></div>
        </div>
      </div>
    </div>
  )
}

function OptionSwitcher({ active }: { active: BrandOptionSlug }) {
  return (
    <nav className="option-switcher" aria-label="Compare visual directions">
      {brandOptions.map((option) => (
        <Link key={option.slug} href={`/brand-lab/${option.slug}`} className={option.slug === active ? "is-active" : ""}>
          <span>{option.letter}</span>
          {option.name}
        </Link>
      ))}
    </nav>
  )
}

export function BrandOptionPage({ option }: { option: (typeof brandOptions)[number] }) {
  const currentIndex = brandOptions.findIndex((item) => item.slug === option.slug)
  const nextOption = brandOptions[(currentIndex + 1) % brandOptions.length]

  return (
    <main className={`brand-lab brand-lab-${option.slug}`}>
      <div className="brand-lab-noise" aria-hidden="true" />
      <header className="brand-lab-header">
        <Link href="/brand-lab" className="brand-lab-back"><ArrowLeft /> Brand lab</Link>
        <span className="brand-lab-header-title">PitchGenie / Visual directions</span>
        <span className="brand-lab-header-state"><span /> Comparison mode</span>
      </header>

      <div className="brand-lab-content">
        <div className="brand-lab-intro">
          <div>
            <span className="brand-lab-kicker">Direction {option.letter} · 04</span>
            <h1>{option.name}</h1>
            <p className="brand-lab-descriptor">{option.descriptor}</p>
          </div>
          <p className="brand-lab-summary">{option.summary}</p>
        </div>

        <OptionSwitcher active={option.slug} />

        <VariantPreview variant={option.slug} />

        <section className="brand-lab-details">
          <div className="brand-lab-detail-copy">
            <span className="brand-lab-kicker">Why this route</span>
            <h2>{option.fit}</h2>
            <p>Each direction uses the same product story, but changes the atmosphere, density, and emphasis around it. This is a real route in the app so the choice can be made against a working interface.</p>
            <Link href={`/brand-lab/${nextOption.slug}`} className="brand-lab-next">View {nextOption.name} direction <ArrowUpRight /></Link>
          </div>
          <div className="brand-lab-specs">
            <div><span>Palette</span><div className="brand-lab-swatches">{option.palette.map((color) => <i key={color} style={{ backgroundColor: color }} title={color} />)}</div><small>{option.palette.join(" / ")}</small></div>
            <div><span>Type direction</span><strong>{option.type}</strong></div>
            <div><span>Working status</span><strong className="brand-lab-working"><Check /> Ready for comparison</strong></div>
          </div>
        </section>

        <footer className="brand-lab-footer"><BrandLogo variant={option.slug} compact /><span>Four directions, one product story.</span><Link href="/brand-lab">Return to overview <ArrowUpRight /></Link></footer>
      </div>
    </main>
  )
}

export function BrandLabOverview() {
  return (
    <main className="brand-lab brand-lab-overview">
      <div className="brand-lab-noise" aria-hidden="true" />
      <header className="brand-lab-header">
        <Link href="/" className="brand-lab-back"><ArrowLeft /> PitchGenie</Link>
        <span className="brand-lab-header-title">Visual direction lab</span>
        <span className="brand-lab-header-state"><span /> Four routes ready</span>
      </header>
      <div className="brand-lab-content brand-lab-overview-content">
        <div className="overview-intro">
          <div className="overview-intro-copy">
            <span className="brand-lab-kicker">A working comparison</span>
            <h1>Choose the atmosphere<br />for the product.</h1>
          </div>
          <p>Each page below is a distinct visual route for PitchGenie. The product story stays constant, while the tone, rhythm, and interface language change.</p>
        </div>
        <div className="overview-rule" />
        <div className="overview-grid">
          {brandOptions.map((option) => (
            <Link key={option.slug} href={`/brand-lab/${option.slug}`} className={`overview-option overview-option-${option.slug}`}>
              <div className="overview-option-top"><span className="overview-option-letter">{option.letter}</span><ArrowUpRight /></div>
              <div className="overview-option-swatch-row">{option.palette.map((color) => <i key={color} style={{ backgroundColor: color }} />)}</div>
              <h2>{option.name}</h2>
              <p>{option.descriptor}</p>
              <span className="overview-option-fit">{option.fit}</span>
              <div className="overview-mini-preview"><VariantPreview variant={option.slug} /></div>
            </Link>
          ))}
        </div>
        <div className="overview-footer"><span>PitchGenie / visual system exploration</span><span>Open a direction to inspect the full page</span></div>
      </div>
    </main>
  )
}
