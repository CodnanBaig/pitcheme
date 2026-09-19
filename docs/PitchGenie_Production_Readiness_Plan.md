# PitchGenie — Production-Readiness & Employer-Review Plan

**Purpose:** Turn the current PitchGenie repository into a complete, reliable, deployable working prototype that is strong enough for future employer review and realistic product testing.

**Target outcome:** A recruiter, engineering manager, or founder should be able to open the repository, understand the architecture quickly, launch the app, create an account, generate a proposal or pitch deck, edit/manage/export it, see real usage tracking, and verify that the project is tested and professionally engineered.

**Working update:** 2026-09-19 — enterprise visual direction selected; baseline gates, environment checks, strict operational configuration validation, request validation, export sanitization, CI workflow, document workspace, transactional initial/version snapshots, a versioned structured-output normalizer, bounded pricing-table output, a repeatable deployment-probe command with dependency-contract checks, bounded database readiness behavior, query-backed Stripe reconciliation indexes, a recoverable App Router error boundary, and a reproducible Chromium-backed container path are in place. Billing-disabled deployments now avoid presenting an actionable upgrade path. CI now requires the production image's MongoDB-backed readiness probe and Docker healthcheck, and older documents have a dry-run-first version-history backfill. PDF export now uses `playwright-core` with an explicit deployment Chromium path, removing the prior browser-downloader dependency exception. Structured pitch-deck editing and seven-day signed read-only share links are now implemented; persistent hashed share records now support owner revocation and view analytics, and privacy-safe product event telemetry now covers critical generation/export/edit/restore/quota actions plus generation safety blocks. The new `pnpm quality:surface` gate scans runtime paths for placeholder destinations, unfinished copy, and empty click handlers so the enterprise surface cannot regress into visible dead controls. Hosted verification and deployment gates remain explicit. Remaining items below are intentionally explicit release blockers rather than implied completeness.

The latest readiness pass also bounds document-export concurrency and Chromium/DOCX operation timeouts so expensive export work cannot exhaust a process or outlive the route budget. Semver-tagged releases now publish provenance/SBOM-enabled images to GHCR, the TypeScript gate enforces unused-code checks, and both runtime readiness and deployment verification now fail closed when a release reports an unknown or missing build version/commit.

The current pass also keeps owner-scoped document CRUD, sharing, duplication,
and version handlers inside the request-ID JSON error boundary when the session
store or shared rate limiter is unavailable. Dashboard and document workspace
fallbacks now emit the same bounded route-failure telemetry when their data
loads degrade to an explicit unavailable state.

Unknown application routes now use an enterprise-styled global not-found page
with safe home and sign-in recovery links.

The maintenance job now retains generation and product-event telemetry for 180
days and reports those counts in its dry run before any deletion is enabled.

The container build now installs the package manager from the integrity-qualified
`packageManager` field through Corepack, keeping local, CI, and image dependency
resolution on the same pnpm pin.

The Playwright web-server harness now keeps its `NEXTAUTH_URL` aligned with the
explicit local test base URL instead of overriding it with a non-local callback
host while deterministic E2E mode is enabled.

Deployment verification now accepts plain HTTP only for loopback smoke targets;
non-loopback release URLs must use HTTPS so the security-header and HSTS checks
cannot be bypassed by an insecure operator URL. Health probes also reject HTTP
redirects instead of following them, keeping readiness evidence bound to the
operator-supplied deployment origin.

Prisma-backed server-rendered pages now pin themselves to the Node runtime as
well as API handlers, making the MongoDB/auth execution contract explicit at
the route boundary.

Authentication event logging now records provider and account-creation state
without writing raw user identifiers or email addresses to operational logs.

The internal four-direction brand lab is now disabled in production by default
through `BRAND_LAB_ENABLED`, keeping non-enterprise visual alternatives out of
customer-facing deployments while preserving the local comparison route.

The CI quality layer now includes `pnpm quality:telemetry`, which audits every
API route for bounded operational telemetry whenever it emits an error log. The
App Router error boundary also reports only a validated framework digest to a
rate-limited same-origin endpoint, so browser-rendering failures can reach the
same optional monitoring adapter without forwarding exception text.

Deployment verification now checks the public landing and pricing HTML, the
enterprise global 404 response, and their correlation/security headers. It can
also require `/brand-lab` and all four known option routes to return `404`,
proving customer-facing smoke checks preserve the selected enterprise surface
across the index and dynamic option routes.

Generation industry selectors and removable multi-select values now expose
keyboard-operable semantics while preserving the existing enterprise form
presentation.

The root layout no longer depends on a compile-time Google Fonts request; the
same enterprise system-sans fallback now builds cleanly in restricted network
environments.

---

## 1. Current State Snapshot

### Status legend

- ✅ **Complete / already materially implemented**
- 🟡 **Partially implemented / needs hardening**
- ⬜ **Not implemented**
- 🔴 **Blocking issue for production-quality prototype**

### Current feature status

| Area | Status | Current state |
|---|---:|---|
| Next.js application structure | ✅ | App Router structure exists with dashboard, auth, generation, document, billing, settings and API routes |
| React + TypeScript UI | ✅ | Main pages and forms exist |
| Authentication | 🟡 | Credentials + email provider architecture exists; bounded email/client login guards and request validation are implemented; production callback/provider verification remains |
| Prisma data layer | ✅ | User, sessions, subscriptions, usage and document models exist |
| Production database | 🟢 | MongoDB is the sole runtime datastore and is documented as a replica-set transaction backend; schema/index setup is documented and the stale tracked SQLite artifact has been removed |
| Proposal generation | ✅ | End-to-end generation API exists |
| Pitch deck generation | ✅ | End-to-end generation API exists |
| Industry-specific prompting | ✅ | Technology and Healthcare workflows exist |
| Model selection | 🟢 | OpenRouter model roles have reviewed defaults, bounded deployment overrides, and deterministic fallback sequencing; all four refreshed defaults were present in the live provider catalog on 2026-09-19, while credential-backed generation remains a release gate |
| Retry/fallback | 🟢 | Provider failure uses one capped retry with backoff, then the configured fallback model and lightweight model in order; richer provider policy remains |
| Structured LLM output | 🟢 | Proposal and pitch-deck JSON contracts are shape-validated with one repair pass and a controlled legacy-text fallback; visual/PDF paths now prefer the same safe contract, and proposal pricing rows normalize into bounded Markdown tables |
| Streaming generation | 🟢 | Proposal and pitch-deck forms use SSE endpoints that stream provider deltas and machine-readable stages while reusing the existing validation, fallback, usage, and persistence path; client disconnects abort scoped provider work without fallback retries, while real-provider latency checks remain external |
| Token tracking | ✅ | Token count is stored in metadata |
| Generation latency tracking | ✅ | Generation time is stored |
| Cost tracking | 🟢 | Generation records store zero cost for free aliases and an optional bounded blended paid-model estimate |
| Prompt/version tracking | 🟢 | Generation metadata stores the selected model, output format, and structured/legacy prompt version |
| Saved documents | ✅ | Generated documents are persisted |
| Documents list | 🟢 | Data is real; search, type/date filters, sort, view, download, edit, duplicate, delete, expiring share-link issuance, and bounded load-more pagination are wired |
| Document view | ✅ | Proposal/deck detail pages exist with ownership-scoped queries |
| Edit document | 🟢 | Ownership-scoped editor and PATCH API persist title, client metadata and content; structured pitch decks expose slide title, key points, visual direction, and speaker notes while legacy documents retain raw editing |
| Delete document | 🟢 | Ownership-scoped DELETE API and confirmed workspace action exist; dependent versions, shares, telemetry, and generation references are cleaned up transactionally |
| Duplicate document | 🟢 | Ownership-scoped duplicate API and workspace action exist |
| Share document | 🟢 | Owner-scoped API issues seven-day signed read-only links backed by hashed lifecycle records; sanitized proposal/deck rendering, owner revocation, expiry state, and aggregate view analytics are implemented |
| Version history | 🟢 | MongoDB snapshots plus editor history/restore and atomic ETag-based stale-write protection are implemented; generation, duplication, autosave, restore, and deletion keep document state and dependent snapshots transactionally consistent, while `pnpm db:migrate:versions` provides a dry-run-first, idempotent baseline backfill for older documents |
| Proposal PDF export | ✅ | Implemented with Playwright Core and an explicit deployment Chromium path |
| Proposal DOCX export | ✅ | Implemented |
| Pitch deck PDF export | 🟡 | Route exists; needs production verification and visual-quality pass |
| Usage limits | 🟢 | Monthly proposal/deck usage is tracked; MongoDB mode atomically reserves finite-plan capacity and releases failed-generation reservations against the original reservation month |
| Subscription data model | ✅ | Exists; reads normalize unknown persisted plan/status values to a safe non-paid state until verified billing data repairs the row |
| Stripe billing | 🟡 | Guarded Stripe test-mode checkout, portal, signed webhooks, durable event-ledger deduplication with retryable active deliveries, stale-claim recovery, conflict-safe ownership reconciliation, monotonic event ordering, unambiguous paid-plan reconciliation, and subscription synchronization are implemented; real Stripe verification remains |
| Pricing page | 🟡 | Pricing route stages checkout by default and exposes paid-plan actions only when `STRIPE_BILLING_ENABLED=true` |
| Dashboard metrics | 🟢 | Document counts and current-month generation usage are sourced from MongoDB-backed records; database failures render an explicit unavailable state rather than misleading zeroes, and no hardcoded success rate remains |
| Health endpoint | 🟢 | `/api/health/live` is process-only; `/api/health` and `/api/health/ready` run Mongo/config probes, with production requiring MongoDB index and Chromium export-runtime checks while cached OpenRouter/Stripe and model-catalog probes remain deployment-configurable |
| Unit/API/integration tests | 🟢 | 73 suites / 466 tests pass locally and are enforced by the baseline CI workflow; coverage remains diagnostic at 69.35% statements / 60.66% branches / 65.40% functions / 72.04% lines |
| E2E tests | 🟡 | Portable Playwright Chromium smoke covers protected-route redirect, invalid and valid credentials, sign-out, account menu, staged pricing, deterministic proposal/pitch-deck generation, owner-issued read-only share rendering and revocation, structured pitch-deck slide editing, proposal editor autosave/versioning, guarded version restore, and a two-tab stale-write conflict, local proposal PDF/DOCX and pitch-deck PDF responses, proposal search/filter/duplicate/delete, cross-user ownership isolation, free-plan quota enforcement, desktop/mobile serious-critical accessibility, and a mobile viewport workspace journey; all 21 tests passed against an isolated MongoDB Atlas rehearsal database, while real-provider and deployed export-runtime checks remain |
| Accessibility testing | 🟡 | Serious/critical axe checks cover public, pricing, auth, and authenticated workspace routes on desktop and Pixel 5 mobile; full WCAG coverage and broader device coverage remain |
| Rate limiting | 🟢 | Registration uses normalized client and email buckets, while generation and export use bounded guards; exports also allow only one active job per account and two per application instance; shared MongoDB buckets are periodically pruned; production runtime validation requires `RATE_LIMIT_STORE=mongodb` for shared buckets and atomic usage reservations, while `process` remains local-development-only and shared-store failures fail closed |
| Abuse prevention | 🟡 | Generation requests have bounded input, timeout, per-route 10/minute and account-wide 20/hour guards, one-in-flight controls, high-confidence prompt-injection and unsafe-request rejection, and privacy-safe safety-block telemetry; broader content moderation remains |
| Observability | 🟡 | Request-correlated generation records, bounded request IDs across API and server-rendered page requests, sanitized operational logs, framework-level `instrumentation.ts` capture, a rate-limited digest-only client error-boundary endpoint, classified generation/export/auth/Stripe/workspace-route failure events, health probes, and an optional bounded error-monitoring webhook adapter exist; the hosted monitoring endpoint is still unconfigured |
| CI/CD | 🟡 | GitHub Actions runs the production dependency audit, baseline gates, deterministic AI evaluation, built-server and production-container smoke with Chromium export-runtime readiness, dependency/security-header verification, and provenance checks enabled, plus Playwright desktop/mobile smoke; semver tags now publish a provenance/SBOM-enabled GHCR image, while platform deployment remains |
| Container deployment | 🟡 | Multi-stage `Dockerfile` installs the Linux Prisma engine and Chromium, prunes development dependencies from the runtime layer, embeds release provenance, and exposes a readiness-backed Docker healthcheck; the latest production-shaped `pnpm build` and built-server surface smoke pass, semver tags publish the image to GHCR with immutable commit metadata and OCI attestations, while a hosted OCI rehearsal remains |
| README | 🟢 | Setup and deployment details now match the MongoDB runtime |
| Demo deployment | 🟡 | Historical deployment work exists; needs clean current production deployment |
| Employer-facing case study | 🟢 | Evidence-backed case study is documented in `docs/PitchGenie_Employer_Case_Study.md`; live-demo and hosted-verification claims remain separate release gates |

### Overall readiness

- **Core product MVP:** ~65–70%
- **Employer-review ready:** ~50–55%
- **Commercial production ready:** ~35–40%

The next goal is **not** full commercial scale. The goal is a highly credible, complete prototype with production-minded engineering.

---

# 2. Definition of “Complete Working Prototype”

PitchGenie will be considered complete for this milestone only when the following user journey works reliably:

1. Visitor lands on a polished homepage.
2. User can create an account and sign in.
3. User enters the dashboard.
4. User chooses **Proposal** or **Pitch Deck**.
5. User selects an industry.
6. User fills the required structured brief.
7. AI generation begins with visible progress.
8. AI returns validated structured data.
9. Generated output is persisted.
10. User can view the result.
11. User can edit and save it.
12. User can duplicate it.
13. User can delete it.
14. User can export it.
15. User can search/filter their documents.
16. User sees accurate usage statistics.
17. Usage limits are enforced.
18. Stripe test-mode billing upgrades the account.
19. Errors are handled gracefully.
20. Critical flows are covered by automated tests.
21. A deployed demo can be used without developer intervention.
22. The GitHub repository explains architecture, trade-offs, setup and testing.

---

# 3. Delivery Strategy

## Branching

Use:

- `main` — always deployable
- `develop` — integration branch during the overhaul
- `feature/<name>` — scoped work
- `fix/<name>` — targeted bug fix

Every phase should finish with:

- clean build
- passing automated tests
- updated README/changelog where relevant
- deployed preview
- merge into `develop`
- checkpoint review before continuing

---

# 4. Phase 0 — Baseline Audit & Repository Cleanup

**Goal:** Establish a trustworthy starting point before feature work.

### Tasks

- [ ] Create `develop` from current `main`.
- [x] Run clean install using the lockfile.
- [x] Run:
  - `pnpm build`
  - `pnpm test`
  - `pnpm test:coverage`
  - TypeScript check
  - ESLint
- [x] Record every current failure in `docs/BASELINE_AUDIT.md`.
- [x] Remove stale SQLite references from setup and README.
- [x] Remove `prisma/dev.db` now that MongoDB is the permanent datastore.
- [x] Verify `.env*` files are ignored.
- [x] Create `.env.example`.
- [x] Remove the two verified-unused legacy generation form components and the
  superseded prompt-template module; the targeted component inventory confirms
  the remaining editor/form shells are intentional lazy boundaries.
- [x] Confirm no secrets or API keys are committed.
- [x] Update package scripts so `lint`, `typecheck`, `test`, and `build` all work.
- [x] Audit dependencies for stale or incompatible versions; production-only audit is clean and the deployment Chromium runtime is explicit.
- [x] Upgrade Next.js/Auth, AI SDK, DOCX, Nodemailer and the PDF browser runtime in a controlled dependency change; keep the NextAuth peer warning visible if email magic links are enabled.
- [x] Add `CONTRIBUTING.md` or a concise development workflow section.

### Checkpoint 0

**Pass only if:**

- [x] clean clone installs successfully
- [x] build succeeds after the build script generates the Prisma client
- [x] existing test failures are understood and documented
- [x] database configuration in README matches the code
- [x] no development DB binary remains in the repo unless deliberately required
- [x] `.env.example` exists and is tracked outside the ignored environment files
- [x] repository has no obvious secret leakage (tracked-file pattern scan is clean; provider secret scanning remains a release practice)

---

# 5. Phase 1 — CI, Code Quality & Test Foundation

**Goal:** Make regressions difficult.

### CI pipeline

Create `.github/workflows/ci.yml`. **Done for the baseline gates, including a
MongoDB service, schema synchronization, a built-server smoke test, and a
Chromium/Playwright smoke stage; external deploy and full product journeys
remain future work.** The initial hosted run exposed a pnpm action/version
duplication, which is fixed by letting the action use the integrity-qualified
`packageManager` declaration; a subsequent green hosted run is still required.

Run on every pull request and push to `main`/`develop`:

1. install
2. lint
3. typecheck
4. unit tests
5. integration/API tests
6. build
7. Playwright Chromium smoke tests

### Required scripts

Add/repair:

```bash
pnpm lint
pnpm quality:imports
pnpm quality:secrets
pnpm quality:surface
pnpm quality:telemetry
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:api
pnpm test:integration
pnpm test:security
pnpm test:e2e
pnpm test:coverage
pnpm build
```

### Coverage targets

Initial target:

- **Statements:** 75%+
- **Branches:** 65%+
- **Functions:** 70%+
- **Critical services/API routes:** 85%+

Do not chase 100% coverage. Prioritize risk.

### Testing layers

#### Unit tests

Cover:

- plan-limit calculation
- usage incrementing
- field configuration selection
- model selection
- prompt builders
- generation result parsing
- sanitization utilities
- export-format conversion
- authorization helpers

#### API tests

Cover:

- register
- authenticated/unauthenticated generation
- usage-limit response
- valid and invalid generation input
- document ownership
- export authorization
- not-found behavior
- Stripe webhook validation
- CRUD endpoints

#### Integration tests

Cover:

- generation → DB persistence
- usage increment after successful generation
- failed generation does **not** increment usage
- subscription plan → limit behavior
- document ownership isolation

### Checkpoint 1

- [x] CI runs automatically
- [x] quality workflow has a bounded 30-minute execution timeout
- [ ] build cannot merge while CI is red
- [x] coverage report is generated
- [x] critical services have meaningful assertions
- [x] tests do not rely on production services
- [x] AI calls are mocked in normal CI

---

# 6. Phase 2 — Data Model & Persistence Hardening

**Goal:** Make documents editable, versionable and auditable.

### Update `Document`

Recommended fields:

- `id`
- `userId`
- `type`
- `title`
- `status`
- `industry`
- `contentJson`
- `renderedContent`
- `metadata`
- `createdAt`
- `updatedAt`
- `lastEditedAt`

### Add version model

`DocumentVersion`

- `id`
- `documentId`
- `userId`
- `versionNumber`
- `contentJson`
- `createdAt`
- `source` (`ai`, `user-edit`, `regeneration`)

### Add generation model

`Generation`

- `id`
- `requestId`
- `userId`
- `documentId`
- `generationType`
- `provider`
- `model`
- `promptVersion`
- `inputTokens`
- `outputTokens`
- `totalTokens`
- `durationMs`
- `estimatedCost`
- `status`
- `errorCode`
- `repairAttempted`
- `createdAt`

### Security requirements

Every document/version/generation query must scope by authenticated `userId`.

### Checkpoint 2

- [x] document ownership cannot be bypassed
- [x] version history persists
- [x] generations have traceable metadata
- [x] old documents migrate safely with the dry-run-first version-history backfill
- [x] tests prove cross-user access is denied

---

# 7. Phase 3 — Rebuild AI Generation as a Structured Pipeline

**Goal:** Make the AI layer technically impressive and reliable.

Current pattern:

`form → prompt → generateText → huge text blob → DB`

Target pattern:

`form → normalized brief → planning → structured generation → validation → optional repair/fallback → persistence → renderer`

## 7.1 Define schemas

Use Zod or equivalent.

### Proposal schema

Example:

```ts
{
  title,
  executiveSummary,
  clientContext,
  objectives[],
  scope[],
  solution,
  methodology,
  timeline[],
  deliverables[],
  pricing[],
  risks[],
  assumptions[],
  nextSteps[]
}
```

### Pitch deck schema

```ts
{
  company,
  tagline,
  slides: [
    {
      type,
      title,
      subtitle,
      bullets[],
      metrics[],
      visualSuggestion,
      speakerNotes
    }
  ]
}
```

## 7.2 Generation pipeline

- [x] Normalize form data before prompt construction and persistence.
- [x] Reject invalid/underspecified requests before usage reservation or provider calls.
- [x] Create and persist `promptVersion` for structured and legacy generation paths.
- [x] Add structured-output generation (versioned JSON prompts plus a renderer-compatible normalizer).
- [x] Validate LLM output against complete proposal and pitch-deck schemas.
- [x] If invalid, run one repair pass; fail closed when repair remains invalid.
- [x] If provider fails, use fallback model.
- [x] Add explicit timeout.
- [x] Pin generation, streaming, and PDF export handlers to the Node runtime
  with a 60-second route duration budget for serverless hosts that support it.
- [x] Pin the remaining Prisma-backed CRUD, profile, share, authentication,
  Stripe, and health handlers to Node with explicit bounded route budgets.
- [x] Propagate one 55-second request deadline through provider retries,
  structured-output repair, and model fallbacks.
- [x] Add one capped retry with exponential backoff for retryable provider failures.
- [x] Persist provider/model/token/duration data, output format, prompt version, repair state, and a request-correlated success/failure record.
- [x] Return machine-readable generation status.

## 7.3 Streaming

Implement visible generation progress without weakening the existing persistence
and validation path.

Options:

- [x] stream provider text deltas through an opt-in SSE transport
- [x] stream status events while generation completes server-side
- [x] abort provider work when the consumer disconnects without retrying a cancelled request

User-facing stages:

1. Understanding brief
2. Building outline
3. Writing sections/slides
4. Validating
5. Finalizing document

## 7.4 Prompt architecture

Move prompts into explicit versioned files/modules:

- `prompts/proposal/v1.ts`
- `prompts/pitch-deck/v1.ts`
- `prompts/industries/technology.ts`
- `prompts/industries/healthcare.ts`

Never bury important prompt logic inside route handlers.

## 7.5 Model strategy

Use a provider abstraction so model/provider can change without touching product code.

Implement:

- primary model
- fallback model
- lightweight/cheap model
- structured output capability metadata
- model timeout policy
- per-model cost config

Do not rely permanently on unstable free model aliases.

### Checkpoint 3

- [x] standard proposal generation returns schema-valid structured output or a controlled legacy fallback
- [x] standard pitch deck generation returns schema-valid structured output or a controlled legacy fallback
- [x] invalid model output is repaired or rejected cleanly
- [x] fallback behavior is covered by tests
- [x] generation metadata is persisted
- [x] UI shows streamed multi-stage progress while generation completes

---

# 8. Phase 4 — AI Evaluation Harness

**Goal:** Show employers that AI quality is measured rather than guessed.

### Create `evals/`

Include representative fixtures:

- simple software proposal
- complex SaaS architecture proposal
- healthcare proposal
- early-stage startup pitch
- traction-heavy startup pitch
- intentionally vague brief
- adversarial/garbage input

### Evaluation dimensions

Score:

- required sections present
- factual grounding against user input
- no invented metrics
- no contradictory pricing/timeline
- useful specificity
- structure compliance
- tone appropriateness
- duplication/repetition
- length boundaries

### Automated evals

Use deterministic checks where possible.

Example:

- all required slide types exist
- output validates against Zod schema
- no blank sections
- no forbidden placeholder text
- metrics must come from supplied data unless explicitly labeled as estimates

### Optional LLM-as-judge

Use only as a secondary signal.

Persist eval score with prompt/model version.

### Checkpoint 4

- [x] at least 15 representative eval fixtures
- [x] eval command can be run locally
- [x] prompt changes can be compared
- [x] README documents how AI quality is evaluated

---

# 9. Phase 5 — Full Document Management

**Goal:** Replace placeholder buttons with real product behavior.

### Required CRUD

- [x] View
- [x] Edit
- [x] Save
- [x] Autosave (debounced, with visible failure state)
- [x] Rename
- [x] Duplicate
- [x] Delete with confirmation
- [x] Search
- [x] Filter by type
- [x] Filter by date
- [x] Sort
- [x] Pagination or cursor loading

### Versioning

- [x] Save new versions after meaningful edits.
- [x] Show previous versions.
- [x] Restore previous version.

### Regeneration

Allow section-level AI actions:

- rewrite
- shorten
- expand
- improve tone
- regenerate section
- regenerate slide

Do not require regenerating the whole document.

### Checkpoint 5

- [x] every visible document action works
- [x] there are no dead document-workspace controls
- [x] search/filter work against actual data
- [x] version restore works
- [x] CRUD tests exist
- [x] user cannot modify another user’s document

---

# 10. Phase 6 — Editor Experience

**Goal:** Make generated output genuinely usable.

### Proposal editor

Recommended:

- block editor or structured section editor
- inline headings
- bullet editing
- pricing table editing
- timeline editing
- section drag/reorder if time permits

### Pitch deck editor

Each slide should be editable as a structured unit:

- [x] title
- [x] key points
- [x] metric callouts (represented within key points)
- [x] visual direction
- [x] notes

### Autosave

- debounce 500–1000 ms
- optimistic status
- show:
  - Saving…
  - Saved
  - Save failed

### Checkpoint 6

- [x] generated document can be fully edited
- [x] edits persist after refresh
- [x] autosave failure is visible
- [x] edit behavior covered by integration/E2E test

---

# 11. Phase 7 — Export System Hardening

**Goal:** Make exported files professional and deployable.

### Proposal PDF

Current implementation: ✅

Improve:

- [x] HTML escaping/sanitization
- [x] polished document theme (enterprise navy, cloud, and teal tokens)
- [x] page numbers
- [x] cover page
- [x] header/footer
- [x] consistent typography
- [x] pricing tables (bounded Markdown tables render as styled PDF/DOCX tables)
- [x] smart page breaks for headings and cover content

### DOCX

Current implementation: ✅

Improve:

- [x] proper heading hierarchy
- [x] bullet groups
- [x] tables (bounded Markdown tables render as native DOCX tables)
- [x] page margins
- [x] cover page
- [x] metadata/title

### Pitch deck PDF

Target:

- [x] landscape 16:9
- [x] one slide per page
- [x] enterprise theme tokens
- [x] editable slide structure feeds renderer
- no raw LLM HTML

### Serverless compatibility

The Playwright Chromium runtime must be validated on deployment.

If native Chromium is problematic:

- use compatible serverless Chromium package
- or separate export worker/service

### Tests

- response type
- authorization
- valid PDF signature
- DOCX archive validity
- correct ownership
- malicious input sanitization

### Checkpoint 7

- [ ] exports work in deployed environment (requires a deployment Chromium check)
- [x] output uses the selected enterprise visual direction
- [x] no generated document leaks another user’s data in the local cross-user browser smoke (deployed-provider verification remains)
- [x] export failures are gracefully handled

---

# 12. Phase 8 — Billing & Usage

**Goal:** Complete the SaaS loop in Stripe test mode.

### Pricing

Create `/pricing`.

Suggested prototype plans:

#### Free

- 5 proposals/month
- 3 pitch decks/month
- core templates
- basic export

#### Pro

- higher/unlimited limits
- premium templates
- version history
- section regeneration

Avoid pretending Enterprise functionality exists unless implemented.

### Stripe

- [x] re-enable Stripe SDK behind an explicit `STRIPE_BILLING_ENABLED` flag
- [ ] configure test products/prices
- [x] checkout session
- [x] webhook signature verification
- [x] durable webhook event ledger and duplicate-delivery handling
- [x] subscription state update
- [x] customer portal
- [x] cancellation state synchronization
- [x] downgrade/plan-change state synchronization
- [x] failed payment handling state transition

### Billing tests

Mock Stripe for CI.

Verify:

- [x] checkout requires auth
- [x] webhook rejects invalid signature
- [x] subscription updates plan
- [x] cancellation changes state correctly
- [x] free plan limits remain enforced

### Checkpoint 8

- [ ] Stripe test purchase upgrades account
- [ ] customer portal loads
- [ ] subscription state persists
- [ ] usage limits reflect current plan
- [x] dashboard never advertises an unavailable paid feature (billing-disabled deployments show staged billing copy)

---

# 13. Phase 9 — Security & Abuse Prevention

**Goal:** Make the prototype safe enough to expose publicly.

### Input validation

Add Zod validation to every write endpoint.

### Rate limiting

At minimum:

- auth endpoints
- generation endpoints
- export endpoints

Use user ID + IP strategy.

### AI abuse limits

- max field lengths
- max request size
- max request nesting depth (32 levels)
- generation concurrency limit (implemented per process)
- [x] per-user hourly limit (20 generation attempts per account, shared across proposal and pitch-deck routes)
- monthly plan limits
- timeout
- max tokens

### Content safety

At minimum:

- reject obvious prompt-injection attempts that try to alter system behavior
- reject high-confidence requests to create credential theft or malware tooling
- isolate system prompts from raw user content
- never interpolate untrusted content into executable HTML without sanitization

### HTTP/security

- [x] secure cookies
- [x] production auth URL
- [x] CSRF behavior verified for custom state-changing APIs, with NextAuth and Stripe callback exemptions
- [x] security headers
- [x] no sensitive server logs

### Checkpoint 9

- [x] rate-limit tests exist
- [x] malformed input returns 400, not 500
- [x] auth failures return consistent 401/403 on protected document/generation/export APIs
- [x] secrets never reach client bundle
- [x] generated/exported HTML is sanitized
- [x] high-confidence prompt-injection instructions are rejected before usage or provider work
- [x] explicit harmful-tooling requests are rejected before usage or provider work
- [x] cross-user access tests pass for document APIs

---

# 14. Phase 10 — Observability & Reliability

**Goal:** Make failures diagnosable.

### Add structured logging

Log:

- request ID
- user ID hash/reference
- route
- generation ID
- model
- latency
- status
- fallback use
- error category

Never log passwords, session tokens or full private document content.

Generation endpoints now return and log a safe `X-Request-ID` value. Started
generations persist the operational fields above without storing prompts or
generated document content. Privacy-safe product telemetry is now persisted
for the critical generation, export, edit, restore, and quota events without
storing prompts or generated content. External error tracking remains
deployment work.

### Error tracking

Configure an error-monitoring provider such as Sentry or equivalent through
`ERROR_MONITORING_WEBHOOK_URL` (or replace the adapter with the provider's
native SDK when the hosting choice is fixed).

The client error boundary posts only a validated framework digest to
`/api/telemetry/client-error`; it never sends exception messages, document
content, or stack traces. The endpoint is bounded and rate-limited before
forwarding the digest to the optional monitoring adapter.

Track:

- server route exceptions
- failed AI generations
- export failures
- auth failures
- Stripe webhook failures

### Product telemetry

Persist bounded, privacy-safe events for:

- [x] generation started, completed, and failed
- [x] export used and failed
- [x] edit saved
- [x] document restored
- [x] plan limit reached
- [x] generation safety block recorded without user content

The `ProductEvent` ledger stores only ownership references, request IDs, and
allowlisted operational metadata. Prompt text, generated content, credentials,
and provider error messages are excluded; telemetry write failures do not fail
the user-facing request.

### Health/readiness

Existing health route: ✅

Improve to expose:

- application health
- DB connectivity
- build/version SHA

The readiness response now includes a sanitized application version and build
commit identifier (`VERCEL_GIT_COMMIT_SHA`, `GIT_COMMIT_SHA`, or `BUILD_SHA`)
without exposing environment values wholesale. Production readiness fails
closed when `APP_VERSION` or the build commit is missing/unknown. Set
`HEALTHCHECK_EXPORT_RUNTIME=true` in a deployment to fail readiness when the
Chromium binary required for PDF exports is unavailable.

Do not expose secrets.

### Checkpoint 10

- [x] a failed generation can be traced by ID
- [x] critical product events are persisted without private payloads
- [ ] error monitoring works in preview/production
- [x] health endpoint reports meaningful status
- [x] logs contain no private document payloads

---

# 15. Phase 11 — E2E Test Suite

**Goal:** Prove the real app works.

Recommended: Playwright.

### Critical E2E paths

#### Authentication

- [x] register
- [x] sign in
- [x] invalid sign in
- [x] sign out
- [x] protected route redirect

#### Proposal

- [x] create proposal
- [x] generation completes
- [x] saved document opens
- [x] edit
- [x] save
- [x] owner-issued read-only share rendering
- [x] owner can revoke active share links
- [x] owner-scoped share view counts are recorded without storing bearer tokens
- [x] export (local PDF response smoke; deployed runtime remains)
- [x] duplicate
- [x] delete

#### Pitch deck

- [x] create deck
- [x] generation completes
- [x] slides render
- [x] edit slide through the structured editor
- [x] export PDF (local Chromium smoke; deployed runtime remains)

#### Usage

- [x] free limit reached
- [ ] upgrade CTA appears (billing controls now have deterministic staged/error-state component coverage; live billing remains)
- [ ] upgraded account bypasses free limit (API/usage guards are covered; Stripe synchronization remains)

#### Documents

- [x] search
- [x] filter
- [x] open
- [x] ownership isolation (local cross-user browser smoke)

### Testing AI in E2E

Default CI E2E uses the explicit `E2E_TEST_MODE=true` deterministic AI fixture;
it never calls the external provider. `pnpm smoke:provider` is a separate,
opt-in live provider check: it validates all configured model roles against the
catalog and performs a minimal primary-model generation. The
`-- --all-models` form exercises each unique configured model after a model
change. A credential-backed run remains a release gate and is intentionally not
part of ordinary CI.

### Checkpoint 11

- [x] built-server manual browser smoke covers public routes and protected-route redirect
- [x] local manual credentials journey covers register, sign in, dashboard, account menu, and sign out
- [x] Playwright runs in CI
- [x] deterministic proposal and pitch-deck generation journeys pass in Chromium
- [x] local proposal PDF/DOCX and pitch-deck PDF response checks pass with the CI Chromium executable
- [x] serious/critical axe checks run in Chromium for public, auth, and authenticated workspace routes on desktop and Pixel 5 mobile
- [x] critical path passes in Chromium against an isolated MongoDB Atlas rehearsal database (21/21 desktop/mobile tests; the local disposable Docker replica-set remains unavailable on this host)
- [x] mobile viewport smoke test passes for public and authenticated workspace navigation
- [x] screenshots/traces are saved on failure

---

# 16. Phase 12 — Accessibility & Performance

### Accessibility

Target WCAG 2.2 AA where practical.

Verify:

- keyboard navigation
- focus states
- semantic headings
- labels
- form errors
- dialog focus
- contrast
- reduced motion

Add automated axe checks in E2E.

### Performance

Measure:

- landing page
- dashboard
- generation form
- document editor

Targets:

- minimal client JS where possible
- no major CLS
- avoid unnecessary hydration
- lazy-load heavy editor/export assets
- production database indexes

### Checkpoint 12

- [x] no serious/critical axe violations on public, auth, and authenticated workspace smoke routes on desktop and Pixel 5 mobile
- [x] responsive mobile navigation works for public and authenticated workspace headers
- [x] generation and editor routes reserve stable enterprise loading shells
- [x] expensive generation/editor components are lazy-loaded at route boundaries

The build output confirms the lazy boundaries reduce the initial route payloads
to 1.73 kB for each generation route and 1.61 kB for the editor route. A
quantitative CLS budget still needs a hosted browser measurement.

---

# 17. Phase 13 — Production Deployment

**Recommended primary deployment:** Vercel unless there is a strong reason to stay on Netlify.

### Environments

- local
- preview
- production

### Production services

- hosted MongoDB
- OpenRouter / selected LLM provider
- Stripe test mode for portfolio prototype
- email provider
- error tracking

### Environment validation

At startup validate:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- auth URL
- provider key
- Stripe keys
- email credentials

### Deployment checks

- [ ] preview deploy on every PR
- [ ] production deploy only from `main`
- [x] DB migration strategy documented, including the dry-run-first version-history backfill and the separate `pnpm db:deploy` schema/index bootstrap release step
- [ ] export runtime works
- [ ] auth callback URLs correct
- [ ] Stripe webhook URL correct

The repository also supports a reproducible container deployment for Node/OCI
hosts. The image installs Chromium, prunes development dependencies from the
runtime layer, and generates the platform-specific Prisma client during the
build; run `pnpm db:deploy` as a separate release step against
the hosted MongoDB before routing traffic. The image healthcheck calls
`/api/health/ready` and should remain the traffic gate until database indexes,
configuration, and export runtime are healthy.

### Checkpoint 13

- [ ] clean production deployment
- [ ] no console/server errors in core flow
- [ ] live demo can be used from a fresh browser
- [ ] generation and exports work on production
- [ ] mobile flow works

---

# 18. Phase 14 — Employer-Review Packaging

**Goal:** Make the repository tell the engineering story immediately.

## README structure

1. one-line product summary
2. live demo
3. screenshots/GIF
4. why the project exists
5. architecture diagram
6. key technical decisions
7. AI pipeline
8. testing strategy
9. security model
10. local setup
11. environment variables
12. CI/CD
13. trade-offs
14. roadmap

### Architecture diagram

Show:

```text
Browser
  ↓
Next.js App Router
  ├── Auth
  ├── Document API
  ├── Generation API
  ├── Export API
  └── Billing API
        ↓
  Service Layer
  ├── AI Gateway
  ├── Prompt Engine
  ├── Subscription Service
  └── Export Renderer
        ↓
  MongoDB / Prisma
        ↓
OpenRouter / Stripe / Email / Monitoring
```

### Demo mode

Provide either:

- recruiter test account
- or frictionless “Demo Workspace” with seeded content

Never expose real credentials in README.

### Case-study talking points

Employer should be able to identify:

- full-stack ownership
- auth
- database design
- SaaS billing
- AI provider abstraction
- structured output
- fallback/retry behavior
- evaluations
- testing
- exports
- security
- deployment
- product UX

### Checkpoint 14

- [x] README is accurate
- [ ] live demo linked
- [ ] screenshots are current
- [ ] CI badge green (workflow badge is wired in `README.md`; remote status still needs verification)
- [x] repo has no dead code/placeholder features in the audited production
  surface (runtime surface audit is clean, superseded forms and prompt module
  are removed, runtime import graph has no unreachable application modules, and
  the remaining lazy shells are covered by the component inventory contract)
- [x] architecture is documented
- [x] project can be explained in a 2-minute interview answer (see the employer case study)

---

# 19. Test Matrix

| Area | Unit | Integration | API | E2E | Security |
|---|:---:|:---:|:---:|:---:|:---:|
| Auth | ✅ |  | ✅ | 🟡 | ✅ |
| Proposal generation | ✅ |  | ✅ | 🟡 | ✅ |
| Pitch deck generation | ✅ |  | ✅ | 🟡 | ✅ |
| Structured output normalization | ✅ |  | ✅ | ⬜ |  |
| Model fallback | ✅ |  |  | ⬜ |  |
| Usage limits | ✅ | ✅ | ✅ | ⬜ | ✅ |
| Document CRUD |  |  | ✅ | 🟡 | ✅ |
| Version history |  |  | ✅ | 🟡 | ✅ |
| Export |  |  | ✅ | 🟡 | ✅ |
| Stripe | ✅ |  |  | ⬜ |  |
| Rate limiting | ✅ |  |  | ⬜ |  |
| Search/filter |  |  | ✅ | 🟡 |  |
| Accessibility |  |  |  | 🟡 |  |

---

# 20. Priority Order

Do the work in this sequence.

### Must complete before employer review

1. Baseline/build cleanup
2. CI + test foundation
3. structured AI generation
4. document CRUD/editor
5. exports verified in production
6. fake/dead UI removed
7. rate limiting/security
8. E2E tests
9. current deployed demo
10. README/case study

### Strong differentiators

11. AI eval harness
12. cost/token observability
13. version history
14. section-level regeneration
15. Stripe test-mode billing

### Optional after prototype

16. teams/workspaces
17. real collaboration
18. public sharing analytics
19. additional industries
20. enterprise features
21. true multi-tenant organizations

Do **not** expand into these optional areas until the core prototype is polished.

---

# 21. Final Definition of Done

PitchGenie is ready for future employer review when all of the following are true:

- [ ] `main` is green in CI
- [ ] clean clone builds locally
- [ ] user auth works in production
- [ ] proposal generation works
- [ ] pitch deck generation works
- [x] standard output is structured and validated with a legacy fallback
- [x] model fallback works for provider failures
- [x] token/latency/model data is recorded
- [x] documents can be edited
- [x] documents can be duplicated
- [x] documents can be deleted
- [x] documents can be searched/filtered
- [x] version history works
- [x] proposal PDF works in the local browser smoke (deployed export runtime remains)
- [x] proposal DOCX works in the local browser smoke
- [x] pitch deck PDF works in the local browser smoke (deployed export runtime remains)
- [x] usage limits work in the local MongoDB-backed browser smoke (Stripe plan synchronization remains)
- [ ] Stripe test-mode upgrade works (checkout/portal error handling and disabled-state controls are covered; live test purchase remains)
- [x] rate limiting exists (process-local by default; MongoDB-backed shared mode available for multi-instance production)
- [x] critical API security tests pass
- [x] critical E2E journeys pass against an isolated MongoDB Atlas rehearsal database (21/21 desktop/mobile tests; deployed-provider and live-environment checks remain)
- [x] serious/critical accessibility smoke tests pass in the covered routes
- [x] mobile layout smoke passes for public and authenticated workspace navigation (full responsive/WCAG coverage remains)
- [x] observability is present locally (bounded request, route, page-fallback,
  and client-boundary telemetry; hosted monitoring configuration remains)
- [x] no hardcoded fake metrics remain in the public landing page or visual-direction previews
- [x] no visible dead buttons remain in the audited public landing flow
- [x] README reflects actual architecture
- [ ] live demo is linked
- [ ] screenshots are included
- [x] architecture diagram is included
- [ ] repo feels like a product, not an unfinished experiment

---

# 22. Recommended Milestone Labels

Use GitHub milestones:

- **M0 — Baseline Stable**
- **M1 — Test & CI Foundation**
- **M2 — AI Pipeline v2**
- **M3 — Document Workspace**
- **M4 — Export & Billing**
- **M5 — Security & Reliability**
- **M6 — Employer Review Release**

Every open task should belong to one of these milestones.

---

# 23. Employer-Review Release Criteria

Tag the first serious reviewable release as:

`v0.9.0-employer-review`

Release notes should summarize:

- complete end-to-end SaaS flow
- structured LLM pipeline
- AI fallback/evaluation
- authenticated document workspace
- exports
- usage/billing
- automated testing
- CI/CD
- production deployment

That release should be the version linked from the résumé.
