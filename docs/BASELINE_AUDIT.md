# PitchGenie baseline audit

Updated: 2026-09-19

## Passing local gates

The repository now has a repeatable local baseline with the lockfile installed:

```text
pnpm install --frozen-lockfile       PASS
pnpm db:generate                    PASS
pnpm db:deploy                      PASS (local MongoDB `pitchgenie-ci`)
pnpm exec jest --runInBand --silent  PASS (73 suites, 466 tests)
pnpm lint                           PASS
pnpm quality:imports                PASS (runtime import graph)
pnpm quality:secrets                PASS (deployable-code secret scan)
pnpm quality:surface                PASS (runtime placeholder/dead-control scan)
pnpm quality:telemetry              PASS (API error-boundary coverage)
pnpm typecheck                      PASS
pnpm build                          PASS (2026-09-19; production-shaped environment)
pnpm test:ci                         PASS (466 tests; coverage report generated)
pnpm test:e2e                        PASS (21 Chromium tests against an isolated MongoDB Atlas `pitchgenie-e2e` database; local Docker MongoDB remains optional for this rehearsal)
pnpm eval:ai                         PASS (18 deterministic checks)
pnpm smoke:provider                  AVAILABLE (opt-in live credential check; not run locally)
pnpm audit --prod                    PASS (no known vulnerabilities)
actionlint CI workflow               PASS
live OpenRouter model catalog        PASS (4/4 configured default roles present; no credential used)
deployment verifier tests            PASS (local HTTP harness validates dependency statuses, headers, provenance, redirect rejection, JSON content type, bounded probe payloads, public landing/pricing HTML, enterprise 404 content, landing-page brand-link absence, and all production brand-lab routes; hosted URL remains a release gate)
```

The targeted production component inventory confirms the superseded proposal
and pitch-deck forms plus the old prompt-template module are absent. The
remaining generation and editor shells are intentional lazy boundaries and are
covered by the readiness contract; no unreachable application modules remain
in the runtime import graph.

The latest hosted CI run on `main` (run `35307689599`, commit
`0b73e2013d2ce67812e66c458b56809c31f13138`) failed before dependency install:
`pnpm/action-setup` rejected the duplicate pnpm versions declared by the
workflow and the integrity-qualified `packageManager` field. The workflow now
lets `pnpm/action-setup` read the repository's `packageManager` declaration;
the badge remains a release gate until a subsequent hosted run is green.

The host still cannot start the disposable MongoDB replica-set because its
active Colima profile reports `Running` while a guest shell returns
`/bin/bash: Input/output error`, and Docker fails while creating its temporary
mount directory with the same I/O failure. Unrelated containers and volumes
were left untouched. This does not block the browser rehearsal when
`E2E_DATABASE_URL` points at an isolated MongoDB Atlas database: Prisma schema
sync and all 21 desktop/mobile Chromium journeys passed there. Docker remains
the CI/reproducible-container path and the default local-replica-set option,
not a runtime requirement when a managed MongoDB cluster is available.

The Playwright harness now uses its explicit local `E2E_BASE_URL` as the
NextAuth callback URL during deterministic E2E mode; it no longer substitutes a
non-local callback host during the build/start command.

With production-shaped placeholder environment values, the latest
`pnpm build` completed compilation, type validation, static generation, and
route finalization, including the streamed generation routes, structured
pitch-deck editor, signed-share route, and production-gated brand-lab routes.
The build no longer fetches Google Fonts at compile time, so this result is
reproducible in restricted build environments while retaining the enterprise
system-sans fallback.
The built server smoke returned `200` for `/api/health/live`, `/pricing`, and
`/auth/signin`, while `/brand-lab` and all four known option routes returned
`404` with the production gate disabled, and the production landing HTML
contained zero `/brand-lab` links. Readiness correctly returned `503` because
no disposable MongoDB replica set was available. No provider credentials were
persisted.

A clean-install rehearsal copied the current checkout without its local
dependencies, generated artifacts, Git metadata, or environment files;
`pnpm install --frozen-lockfile` installed the locked 859-package graph and the
same production-shaped `pnpm build` completed successfully. This validates the
dependency/build contract from a fresh filesystem; the stricter clean Git clone
gate remains open until the current worktree is published and rebuilt from
that revision.

The public landing page now hides its internal brand-lab navigation and
comparison CTA whenever the production gate is disabled, so customer-facing
navigation does not expose a known 404 path. Those links remain available in
non-production design-comparison environments.

Unknown routes now render the same enterprise workspace shell through
`app/not-found.tsx`, with safe home/sign-in recovery links instead of the
framework default 404 page. The built-server smoke returned `404` for an
unknown path, rendered the recovery copy, and retained the configured security
headers without exposing framework-default text.

The production build also defers the heavy generation forms and document editor
behind client-side lazy boundaries with fixed-height enterprise loading shells.
The generated route table reports 1.73 kB for each generation route and 1.61 kB
for the editor route, keeping those interactive bundles out of the initial
server route payload while preserving stable loading geometry.

Every Prisma-backed API handler explicitly selects the Node runtime. CRUD,
profile, share, authentication, Stripe, and readiness handlers use bounded
10- or 30-second route budgets, while long-running generation, streaming, and
PDF export handlers request 60 seconds on compatible serverless hosts.
Provider retries, repairs, and model fallbacks share a 55-second request
deadline; the deployed plan's maximum remains an external release check.
Stripe SDK calls are capped at a 10-second timeout and two retries.
Owner-scoped document handlers also keep session-store and shared rate-limit
failures inside the same request-ID JSON error boundary instead of allowing a
framework-level response to escape without correlation.

The clean-checkout build path also runs Prisma generation automatically through
the `prebuild` script, so `pnpm install --frozen-lockfile && pnpm build` does
not depend on a generated client being present in the checkout. The repository
also has a reproducible OCI deployment path. An earlier release-shaped
`docker build` produced the multi-stage image with the Linux Prisma engine and
Chromium installed in the runtime layer. An isolated MongoDB 8 smoke
synchronized the schema and indexes, then returned `200` for both
`/api/health/live` and `/api/health/ready`; `pnpm verify:deployment` confirmed
the request-correlation, cache, and security headers plus `local-readiness`
provenance, and Docker reported the container `healthy`. That task-owned
database and container were removed after verification. The current Dockerfile
also prunes development dependencies from the runtime layer, but a fresh local
image build could not be rerun because the host's legacy Docker builder could
not resolve `node:20-bookworm-slim` from Docker Hub; CI or a hosted OCI builder
remains the authoritative image-build check. The Dockerfile now resolves the
integrity-qualified pnpm pin through Corepack, and `.dockerignore` excludes
repository-only tests, docs, CI metadata, and local tooling from the build
context.

The current coverage report is a diagnostic rather than a release threshold:
69.35% statements, 60.66% branches, 65.40% functions, and 72.04% lines. The
planned 75%+ baseline is not met because most page components and service
integrations do not yet have meaningful tests.

Framework-level request failures now pass through `instrumentation.ts`, with
application middleware assigning bounded correlation IDs to API and
server-rendered page requests. The client error boundary reports only a
validated framework digest through a
bounded same-origin endpoint, and critical generation, export, auth, Stripe,
profile, document, sharing, version-history, dashboard, and workspace route
failures emit classified operational events. All paths record only bounded
request IDs, route context, categories, and error classes or validated digests.
An optional `ERROR_MONITORING_WEBHOOK_URL` forwards those bounded events with a
1.5-second fail-open timeout; configuring and verifying the hosted monitoring
endpoint remains a deployment gate.
NextAuth sign-in event logs also omit raw user identifiers and email addresses.

The dry-run-first maintenance job now reports and can remove generation and
product-event telemetry older than 180 days alongside expired auth and shared
rate-limit records, keeping operational storage bounded without deleting
document content.

A tracked-file scan for private-key blocks and common provider-token prefixes
found no matches; only `.env.example` is tracked as an environment file. This
is a repository hygiene check, not a replacement for the hosting provider's
secret scanner.

Newly generated and duplicated documents now create their initial
`DocumentVersion` snapshot in the same MongoDB transaction as the document, so
version history is available before the first edit. Autosave, restore, and
document deletion keep the document and dependent snapshots/references in the
same transaction; the dry-run-first backfill remains available for documents
created by older releases.

The source-level release-provenance contract is covered by the health tests and
the earlier container smoke. Production readiness now fails closed when the
release version or commit is missing/unknown; the CI and container smoke paths
provide explicit values, while the local Docker CLI still reports that its
Buildx plugin is missing and falls back to the deprecated legacy builder; CI
uses the hosted builder path.

The production build was verified with a MongoDB-style `DATABASE_URL`, a long
`NEXTAUTH_SECRET`, an HTTPS `NEXTAUTH_URL`, and a placeholder OpenRouter key.
Those production-shaped variables must be present whenever `pnpm build` runs;
the application intentionally fails fast when required runtime configuration is
missing, and rejects deterministic `E2E_TEST_MODE` on a non-local production
URL or malformed `NEXTAUTH_URL`/MongoDB connection strings. The successful
build does not prove that a remote MongoDB cluster,
OpenRouter account, SMTP provider, Stripe account, or deployed Chromium runtime
is reachable.

The built server was also started locally and smoke-tested: `/api/health/live`,
`/api/health/ready`, and `/pricing` returned `200` against the local MongoDB
probe with the configured AI key and disabled Stripe state. The production
shaped smoke environment used an HTTPS `NEXTAUTH_URL`, as required by the
production environment validator. The health responses included the security
headers, `X-Request-ID`, and `Cache-Control: no-store`; with
`HEALTHCHECK_EXPORT_RUNTIME=true` and `HEALTHCHECK_DATABASE_INDEXES=true`,
readiness reported both the configured Playwright Chromium executable and all
Prisma-managed MongoDB indexes healthy, including document-share and product-
event lifecycle indexes. The Playwright stage supplied that
executable explicitly to the PDF renderer for the PDF checks.

A real browser smoke was run against the same built server: the home page,
pricing page, and signup page rendered meaningful content with no Next.js error
overlay; pricing showed the intentionally disabled billing state; and an
unauthenticated dashboard visit redirected to `/auth/signin`. A second local
development smoke against an isolated MongoDB database registered a fresh
credentials account, signed in to the dashboard, opened the account menu, and
signed out back to `/auth/signin`. The production-shaped browser journey also
registered and signed in a fresh user, generated a deterministic proposal,
opened the editor, saved a revision, observed version history, and verified a
stale `If-Match` write returned `409` with the current ETag and request ID
without overwriting the document, then restored the prior version through the
guarded path. The portable Playwright suite now repeats
the protected-route, invalid/valid credentials, account-menu/sign-out, and
disabled-pricing checks in Chromium. The suite also runs deterministic proposal
and pitch-deck generation journeys, owner-issued read-only share rendering,
structured pitch-deck slide editing, local proposal and pitch-deck PDF response
checks through the CI Chromium executable, proposal DOCX archive output,
proposal edit/version/search/filter/duplicate/delete coverage, cross-user
ownership isolation for view/export/delete boundaries, plus serious/critical axe
checks for the public, pricing, auth, and authenticated workspace pages on
desktop and Pixel 5 mobile. A separate mobile Chromium project verifies
viewport fit and authenticated workspace navigation; real-provider and
deployed export-runtime checks remain outside this smoke suite.

An opt-in `pnpm smoke:provider` command now closes the tooling gap between the
deterministic fixture suite and live provider verification. It checks all
configured model roles against the bounded live catalog response and performs
a minimal primary-model generation; `-- --all-models` exercises every unique
configured model. The command has request timeouts and response-size limits and
does not print credentials or provider bodies on failure. It was contract-tested
against a local provider stub; a real credential-backed run remains a release
gate.

The provider's live catalog no longer listed any of the four earlier default
free aliases. The defaults are now centralized in
`config/openrouter-models.json` and refreshed to current catalog entries for
the primary, fallback, lightweight, and visual roles; an unauthenticated live
catalog check confirmed all four entries on 2026-09-19. This proves current
model discoverability, not authenticated generation capacity or output quality.

With `HEALTHCHECK_EXPORT_RUNTIME=true` and an explicit
`CHROMIUM_EXECUTABLE_PATH`, the built server's readiness probe also returned
healthy for the local Chromium executable. Deployment verification remains a
separate release gate.

## Baseline decisions

- MongoDB is the Prisma datasource of record and must support replica-set
  transactions. `pnpm db:deploy` applies the schema and idempotently bootstraps
  required collections/indexes, including the ownership/type/date indexes used
  by document workspace queries and the Stripe customer/subscription lookup
  indexes used by webhook reconciliation. New setup instructions include the replica-set query option;
  the stale tracked SQLite development database has been removed from the
  repository.
- Credentials auth is available without SMTP. The email provider is added only
  when all SMTP credentials are configured.
- Credentials auth uses NextAuth JWT sessions, which is required by NextAuth;
  the Prisma adapter still persists users and accounts.
- CI uses placeholder secrets and never calls external AI, SMTP, or Stripe
  APIs. Its quality job now audits production dependencies, starts an ephemeral
  replica-set MongoDB service, applies the Prisma schema, runs the local gates against that
  service, installs Chromium before smoke testing, passes its executable path
  into the built production server, verifies live/ready/public page/404 routes with the
  export-runtime readiness probe enabled, prepares a separate MongoDB database
  for browser data, builds the production Docker image, and runs the container
  against the CI MongoDB service until both `/api/health/ready` and Docker's
  healthcheck report healthy. The built-server smoke also runs
  `pnpm verify:deployment` to validate both health probes, public page HTML, the
  enterprise 404 surface, correlation and security headers, cache policy, and
  the expected build SHA before it runs the portable
  Playwright smoke suite with failure artifacts. The deterministic AI
  evaluation runs as its own gate before the build.
- The local Playwright web server performs the same `pnpm db:deploy` schema and
  index synchronization against `E2E_DATABASE_URL` before starting. Its
  fallback MongoDB URL includes `?replicaSet=rs0`, so quota, ownership, and
  rate-limit smoke tests exercise MongoDB constraints rather than an
  unindexed ad-hoc database.
- The production `Dockerfile` uses a build-only placeholder environment,
  installs OpenSSL before Prisma generation, copies the schema for a separate
  deployment migration step, installs Chromium for PDF export, and exposes a
  Docker healthcheck backed by `/api/health/ready`. Runtime secrets and the
  hosted MongoDB URL are supplied only when the container starts. Release
  build arguments embed a sanitized application version and commit SHA, and
  the CI container smoke asserts that the running image reports the expected
  commit.
- The public landing page reads the shared Stripe plan catalog, shows paid
  plans as staged when billing is disabled, routes paid actions through the
  guarded pricing page, and contains no placeholder footer destinations.
- Existing MongoDB documents can be made version-history safe with the
  dry-run-first `pnpm db:migrate:versions` backfill. It records the current
  document state as version 1 only when no snapshot exists and requires
  `MIGRATE_DOCUMENT_VERSIONS_CONFIRM=apply` before writing.
- Production builds no longer bypass linting; `pnpm build` and CI both enforce
  the same lint/type/build contract. The repository uses ESLint 9 with its
  flat config so Next.js 15 can run build-time linting without the ESLint 8
  flat-config option mismatch.
- Export filenames are normalized to portable, path-safe names and browser
  cleanup runs even when PDF generation fails.
- Exported proposal and pitch-deck HTML escapes interpolated text and sanitizes
  model-generated slide markup before it reaches the PDF renderer.
- Pitch-deck viewer and PDF prompt paths use the enterprise navy/cloud/teal
  visual system; visual model instructions are style-free and explicitly treat
  brief values as untrusted data rather than executable instructions.
- Structured pitch-deck documents expose title, key-point, visual-direction,
  and speaker-note fields in the editor; edits serialize back through the same
  escaped slide renderer, while legacy text decks keep the raw editor path.
- Export routes use `playwright-core` and require `CHROMIUM_EXECUTABLE_PATH` for
  deployments that provide Chromium outside the package install. The former
  `PUPPETEER_EXECUTABLE_PATH` name remains a compatibility fallback.
- The active generation pages use the enhanced proposal and pitch-deck forms;
  two verified-unused legacy form components were removed from the production
  tree.
- Proposal PDF exports use the selected enterprise navy/cloud/teal theme with a
  cover page, safe page footer, and heading-aware page breaks. DOCX exports set
  document metadata, margins, a cover block, and page numbers.
- Generation routes now let MongoDB/Prisma generate ObjectId-backed document IDs
  instead of writing non-Mongo `prop_…`/`deck_…` values.
- Document routes validate Mongo ObjectId path parameters before querying and
  return bounded client errors for malformed IDs; proposal and pitch-deck
  export routes enforce the same boundary.
- Generation request bodies are bounded to 64 KB with 10,000-character text and
  50-item collection limits; registration validates JSON, email, password, and
  name inputs. Generation option enums and booleans are validated before usage
  checks or provider calls. Core briefs are normalized (trimmed, line-ending
  canonicalized, empty optional values removed), field-specific values are
  type-checked, high-confidence prompt-injection instructions are rejected, and
  placeholder/underspecified briefs are rejected before usage reservation or
  provider calls.
- JSON request bodies are streamed through route-specific byte caps before
  parsing: 64 KB for generation, 8 KB for registration, 4 KB for profile and
  checkout, and 1.1 MB for document edits. The signed Stripe webhook streams
  its raw payload through a separate 1 MiB cap before signature verification.
  Oversized requests receive `413` without reaching database, usage, or
  provider work.
- Server-rendered pitch-deck markup is sanitized before it reaches the browser,
  and authentication event logs record only a user ID/provider instead of the
  full account object.
- HTTP responses now include a baseline Content-Security-Policy and production
  HSTS alongside the existing frame, content-type, referrer, and permissions
  protections.
- Credentials sign-in normalizes email addresses and applies bounded email and
  trusted edge client-address guards outside tests, reducing both
  account-targeted and distributed login abuse. Set `RATE_LIMIT_STORE=mongodb`
  to use the atomic shared MongoDB bucket across instances; production runtime
  validation now rejects the process-local store, shared-store failures fail
  closed, and local/CI defaults can remain process-local.
- Registration now applies the same bounded normalized client-address guard plus
  a normalized email bucket, so changing a forwarded address does not bypass
  the account-creation limit. Email and client-address key parts are SHA-256
  hashed before they enter process or MongoDB rate-limit storage.
- Document owners can issue seven-day HMAC-signed read-only links. The share
  page verifies the token and an owner-scoped, expiry-aware hashed share record
  before querying by document ID, increments a bounded view counter, and
  sanitizes pitch-deck markup; no raw share token or document content is
  persisted in logs. Owners can revoke active links, and deleting a document
  removes its share records.
- Streamed generation carries the request abort signal through the progress
  context so a cancelled browser stream stops provider work and does not enter
  model fallback retries; the wrapped route response and authenticated JSON
  clients also enforce bounded response readers (1 MiB for streamed generation,
  2 MiB for authenticated JSON) before parsing; provider-specific latency
  behavior still needs a live deployment check.
- Health checks expose a dependency-free `/api/health/live` probe plus the
  dependency-aware `/api/health` and `/api/health/ready` readiness probes.
  Set `HEALTHCHECK_EXTERNAL_SERVICES=true` to enable cached, timeout-bounded
  OpenRouter and Stripe API probes; local and CI defaults remain configuration-only.
  Set `HEALTHCHECK_MODEL_CATALOG=true` with the external probes to fail
  readiness when a configured model role is absent from the provider catalog.
  The MongoDB readiness probe also fails fast after a bounded timeout and
  shares one in-flight check, so an unavailable database cannot make a load
  balancer wait on Prisma's default server-selection timeout.
  Set `HEALTHCHECK_EXPORT_RUNTIME=true` to make readiness verify that the
  Chromium executable required for PDF export is a regular executable file.
  Production runtime validation requires both `HEALTHCHECK_EXPORT_RUNTIME=true`
  and `HEALTHCHECK_DATABASE_INDEXES=true`; local development can keep these
  probes disabled.
  Readiness responses also expose a sanitized application version and build
  commit identifier when the deployment supplies one.
- Runtime validation rejects malformed boolean health/billing flags, model
  overrides, cost rates, SMTP ports, and rate-limit-store values instead of
  silently selecting a less safe fallback.
- Registration, generation, and export endpoints have bounded rate guards with
  `429` responses and an atomic MongoDB-backed store for production clusters;
  the shared guard fails closed when MongoDB is unavailable.
- Registration treats the MongoDB unique email index as the final authority;
  a concurrent duplicate request returns a safe `409` conflict instead of an
  internal error.
- When `RATE_LIMIT_STORE=mongodb`, generation routes reserve finite-plan usage
  with a conditional MongoDB update and release the reservation against its
  original month when generation fails, preventing concurrent instances from
  oversubscribing monthly limits or crossing a month boundary during cleanup.
- Subscription reads normalize unknown persisted plan/status values to a safe
  non-paid state, and Stripe webhook ownership reconciliation rejects
  conflicting metadata/customer/subscription references before mutation;
  subscription mutations also ignore older Stripe event timestamps and reject
  subscriptions that contain multiple configured paid plans.
- Generation endpoints also allow only one in-flight generation per user per
  process, preventing duplicate expensive provider calls while a request is
  still running.
- AI generation now has a 45-second per-provider timeout plus a shared
  55-second request deadline across retries, repairs, and fallbacks; empty or
  oversized output is rejected before persisting a document.
- Retryable AI provider failures receive one bounded retry with exponential
  backoff before the configured fallback model and then the lightweight model
  are attempted in order; authentication and validation failures fail over
  immediately.
- OpenRouter model roles keep reviewed defaults but accept bounded,
  whitespace-free environment overrides so provider deprecations can be handled
  without a code release; deterministic AI evaluation remains required before
  promoting an override.
- Server-side failure logs record only a safe error class/name; request payloads,
  generated documents, provider messages, and stack details are not emitted.
- Each started generation now receives a safe request ID and writes a durable
  MongoDB `Generation` record with provider/model, total tokens, latency,
  prompt version, repair state, completion status, estimated cost when
  configured, and a non-sensitive error category. Free model aliases record
  zero cost; paid-model estimates use the optional blended rate. Tracking
  failures are logged without blocking the user response.
- Privacy-safe product events are persisted in a `ProductEvent` ledger with
  bounded metadata for generation start/completion/failure/safety blocks,
  export success/failure, edit saves, version restores, and plan-limit reaches.
  Metadata excludes prompts,
  generated content, credentials, and provider error text; event persistence
  failures never block the user request.
- Generation and export responses return the request ID in JSON or
  `X-Request-ID` headers so operational failures can be correlated without
  logging document payloads.
- Authenticated API JSON and binary export responses are marked
  `Cache-Control: no-store`, and active browser flows do not log generated
  responses or private request errors to the client console.
- Document CRUD/version routes, profile updates, registration, and session
  checks now return the same bounded request ID header on success and failure;
  error logs include only that ID and a safe error class.
- Application middleware supplies the same correlation ID to framework-owned
  handlers, server-rendered pages, and the NextAuth route, so the request
  boundary remains traceable even when an application route does not create
  its own response wrapper.
- Protected browser API helpers now surface structured server validation and
  usage-limit messages to the generation forms instead of collapsing every
  non-2xx response into a generic status error.
- Proposal, standard pitch-deck, visual, and PDF-optimized prompts now request
  versioned JSON output; shape validation and one repair pass run before the
  renderer-compatible normalizer, with a controlled legacy text/HTML fallback
  for older/provider responses and repair state persisted in metadata.
- The document workspace now has ownership-scoped list, edit, duplicate, and
  delete APIs plus working search, type/date filters, sort, bounded pagination,
  download, and edit controls.
- Workspace list and duplicate responses select only document metadata needed by
  the UI; generated content and metadata stay server-side until a detail,
  editor, or export path explicitly needs them.
- Document edits now create ownership-scoped MongoDB version snapshots, with
  history listing and restore controls in the editor.
- Document edits and version restores use an ownership-scoped SHA-256 ETag
  revision. The editor sends `If-Match`; MongoDB applies guarded writes against
  the loaded editable state, and stale tabs receive `409` with the current
  revision instead of silently overwriting newer content.
- The editor now debounces autosave after changes and keeps failures visible;
  explicit save and version restore remain available.
- The settings profile name can be updated through an authenticated API; billing
  and usage values are sourced from the subscription/usage records, while
  notifications and security controls are explicitly marked planned.
- Public landing-page calls to action now route to signup, feature exploration,
  or the enterprise visual direction; they do not present inert demo controls.
- Public marketing copy and visual-direction previews avoid unsupported social
  proof and label illustrative workspace states instead of presenting invented
  performance metrics.
- A deterministic AI evaluation harness now covers 15 representative proposal
  and pitch-deck fixtures, with structured-output, grounding-keyword,
  placeholder, size, and baseline-regression checks.
- Stripe checkout and portal sessions, signed webhook verification, durable
  event-ledger deduplication with retryable active deliveries and stale-claim
  recovery, conflict-safe subscription ownership reconciliation,
  subscription synchronization, payment-failure state transitions, and billing
  UI actions are implemented behind `STRIPE_BILLING_ENABLED=false` by default.

## Dependency audit

The final production-only audit (`pnpm audit --prod`) reports no known
vulnerabilities. `playwright-core` is configured to use a deployment-provided
Chromium binary and does not download browsers at runtime. `sanitize-html` is
pinned to the patched 2.17.7 release with a CommonJS-compatible
`htmlparser2@10.1.0` compatibility override. AI provider utilities are pinned
to the maintained 3.0.37 line with `undici` 6.28.1, and the Next/PostCSS/
Browserslist and Stripe `qs` findings are resolved through reviewed pnpm
overrides. Nodemailer is on the patched 9.1.1 line; its NextAuth peer
declaration still advertises the older 7.x range and should be retested if the
email magic-link provider is enabled.

Dependabot opens weekly grouped updates for the pnpm lockfile and GitHub
Actions. Review those updates with the full CI quality, browser, and deployment
verification gates; do not promote dependency changes based on the audit result
alone.

## Remaining release blockers

- Stripe billing still needs real test-mode products, webhook delivery, and a
  completed checkout/portal/cancellation rehearsal before paid-plan claims can
  be enabled. The application remains safely disabled by default.
- Stripe SDK calls now use a 10-second request timeout and two bounded network
  retries; real provider behavior and idempotency still require the test-mode
  rehearsal above.
- Live provider catalog availability was checked without a credential, but the
  opt-in generation smoke was not exercised with a real key; a deployed
  environment still needs external probes enabled and authenticated generation
  verified with real provider credentials.
- The deployment verifier correctly fails fast with `503` when MongoDB is
  absent and passed with `200` against the isolated container/database smoke;
  a hosted verifier result still requires a reachable production MongoDB
  instance.
- Basic request and output sanity validation, structured generation validation
  with one repair pass, document CRUD, editor persistence, debounced autosave,
  version restore, process-local rate guards, request-correlated generation
  tracking, deterministic AI evaluation, guarded Stripe billing, an optional
  shared limiter/usage reservation mode, and a portable Chromium smoke suite
  with deterministic proposal/pitch-deck journeys, cross-user ownership
  isolation, and free-plan quota enforcement are now present. Section
  regeneration, external error monitoring, real-provider generation, and the
  deployed export-runtime E2E journey are not complete.
- Proposal exports now recognize bounded Markdown tables, rendering pricing
  tables with the enterprise PDF theme and native DOCX table structures.
- PDF export still needs a real deployed Chromium smoke test; the local install
  intentionally has no bundled browser because the export runtime uses
  `playwright-core` and an explicit executable path.
- The container image and readiness/healthcheck are validated locally but still
  need a hosted OCI or platform deployment rehearsal, including the provider
  network allow-list, external probes, auth callback URLs, billing webhooks,
  and rollback path.
- Keep the deployment-provided Chromium path explicit and review browser-runtime
  dependency updates as part of each release.
