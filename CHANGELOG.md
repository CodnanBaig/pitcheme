# Changelog

All notable changes to PitchGenie are documented here.

## [Unreleased]

### Production readiness

- Added an opt-in, bounded OpenRouter provider smoke that validates configured
  model availability and performs a minimal real generation without exposing
  credentials or provider response bodies.
- Refreshed all four default OpenRouter model roles after the previous free
  aliases disappeared from the live provider catalog, and centralized the
  role configuration so runtime validation and smoke checks cannot drift.
- Added bounded request parsing, correlation IDs, security headers, rate
  limiting, usage reservation, and graceful error states across the API.
- Added structured AI output validation with capped fallback/retry behavior,
  streamed generation cancellation, generation tracking, and privacy-safe
  product telemetry.
- Added high-confidence prompt-injection rejection before generation usage or
  provider work, while keeping system prompts isolated from user content.
- Added privacy-safe telemetry for blocked generation attempts without storing
  the submitted brief.
- Hardened production environment validation so malformed operational flags,
  model overrides, cost rates, SMTP ports, and rate-limit stores fail fast;
  production now requires the shared MongoDB rate-limit store plus Chromium and
  MongoDB-index readiness probes.
- Production startup now rejects malformed non-HTTP callback URLs before
  NextAuth can initialize with an invalid base URL.
- Production startup also rejects MongoDB connection strings without a valid
  host, before Prisma can fail later with an opaque connection error.
- Added a Next.js framework-level error hook that records bounded request and
  route context without exception text, query strings, or request payloads.
- Added per-account and per-instance export concurrency guards so PDF/DOCX work
  cannot fan out unbounded Chromium or document-generation jobs.
- Added explicit Chromium launch and render timeouts so export failures release
  capacity before the route duration budget is exhausted.
- Propagated export-request cancellation into rendering and ensured aborted
  PDF/DOCX requests release browser capacity with a bounded `499` response.
- Coalesced simultaneous external readiness probes while retaining bounded
  provider-response caching.
- Hardened deployment verification to require JSON health responses and cap
  probe payloads at 256 KiB.
- Made the CI production-image gate use an explicit hosted Docker Buildx
  builder before the readiness-backed container smoke test.
- Added a semver-tagged, CI-gated GHCR publish job that runs only after the
  full quality/build/container/browser smoke gate and publishes the production
  image with commit provenance and BuildKit SBOM/provenance attestations;
  publication remains separate from platform deployment and traffic enablement.
- Enabled TypeScript unused-local and unused-parameter checks, removing stale
  route types and imports that could otherwise hide production drift.
- Made the CI workflow actionlint-clean, including explicit
  bounded polling loops for container and server smoke checks.
- Fixed the CI pnpm setup to use the integrity-qualified repository
  `packageManager` declaration instead of supplying a conflicting second
  version; the next hosted run must still prove the badge green.
- Aligned the Docker build with the same repository pnpm pin via Corepack,
  avoiding an unqualified package-manager activation in the production image.
- Tightened the Docker build context to exclude repository-only tests, docs,
  CI metadata, and local tooling from production image builds.
- Aligned the setup and contribution guides with the frozen lockfile install
  used by CI for reproducible clean-checkout setup.
- Added billing-control coverage for staged billing and checkout/portal failure
  states so the enterprise UI cannot imply a successful billing action when
  Stripe is disabled or unavailable.
- Reject unsupported proposal and pitch-deck export formats before loading the
  document or allocating an export slot, avoiding unnecessary database and
  Chromium work.
- Bound the opt-in provider model-catalog readiness response to 1 MiB with a
  streaming JSON reader, so malformed or oversized upstream data fails closed.
- Bound streamed generation and authenticated JSON response parsing so oversized
  route or error payloads fail closed before they can grow process memory.
- Added weekly Dependabot coverage for the pnpm dependency lockfile and GitHub
  Actions, grouped to keep routine production and development updates reviewable.
- Made failed shared usage reservations release against the month they reserved,
  preventing a generation that crosses month-end from decrementing the wrong
  monthly usage bucket.
- Bounded Stripe SDK network retries and request timeouts so billing operations
  fail predictably within the application request budget.
- Pinned Stripe checkout, portal, and webhook handlers to the Node runtime with
  an explicit 30-second route budget.
- Pinned authentication, registration, and session handlers to the Node runtime
  with an explicit 30-second route budget for Prisma and password-hash work.
- Pinned all remaining Prisma-backed CRUD, profile, share, and health handlers
  to the Node runtime with explicit 10- or 30-second route budgets.
- Kept document CRUD, sharing, duplication, and version handlers inside their
  request-ID error boundary when the session store is unavailable.
- Aligned landing-page pricing with the shared plan catalog and billing flag,
  and replaced placeholder footer destinations with working routes.
- Marked authenticated generation streams as `no-store` so intermediary caches
  cannot retain generated content while preserving streaming transport headers.
- Hashed email and client-address rate-limit key parts before shared storage so
  authentication throttling does not retain raw personal identifiers.
- Added a normalized registration email bucket alongside the client-address
  guard so rotating forwarded-address values cannot bypass account-creation
  throttling.
- Hardened Stripe webhook ownership reconciliation so conflicting metadata,
  customer, and subscription references cannot mutate the wrong account.
- Made the MongoDB-backed rate limiter fail closed when its shared bucket is
  unavailable, preventing multi-instance deployments from silently diverging
  into independent local limits.
- Hardened subscription reads to normalize unknown persisted plan/status values
  to a safe non-paid state until verified billing data repairs the row.
- Added monotonic Stripe event timestamps so out-of-order subscription
  deliveries cannot overwrite newer billing state.
- Hardened Stripe plan reconciliation to ignore unknown add-ons while rejecting
  subscriptions with multiple configured paid plans.
- Added a shared account-wide hourly generation guard in addition to the
  per-route minute bucket, including streaming generation paths.
- Added periodic cleanup for expired MongoDB rate-limit buckets so shared
  limiter storage remains bounded over long-running deployments.
- Added same-origin protection for custom state-changing API requests while
  preserving NextAuth callback and signed Stripe webhook flows.
- Added a narrow pre-provider safety policy for explicit credential-theft and
  malware-tooling requests, with privacy-safe `unsafe-content` telemetry.
- Added a 32-level generation-payload nesting cap so deeply nested requests
  fail with a bounded validation response instead of exhausting the validator
  call stack.
- Pinned generation, streaming, and PDF export handlers to the Node runtime
  with a 60-second route duration budget for compatible serverless hosts.
- Propagated a shared 55-second generation deadline through provider retries,
  structured-output repairs, and model fallbacks.
- Made retry backoff and structured-output repair abort-aware so disconnected
  generation requests stop promptly without waiting for another provider call;
  late provider responses are discarded before validation or persistence.
- Rejected deterministic `E2E_TEST_MODE` outside an explicit local callback so
  production deployments cannot silently use fixture generation.
- Pruned development dependencies from the production container layer and
  added a readiness contract to keep that image boundary enforced.
- Added ownership-scoped document editing, guarded version history and restore,
  signed expiring share links, revocation, and aggregate view analytics.
- Hardened bearer share pages with no-store caching and a no-referrer policy
  so revocable link tokens are not forwarded through navigation metadata.
- Added MongoDB schema/index bootstrap, readiness probes, deployment
  verification (including dependency-status and security-header contracts),
  Chromium export checks, Docker healthchecks, and CI container smoke coverage.
- Added deterministic Jest, AI evaluation, Playwright Chromium, mobile, and
  serious/critical accessibility coverage.
- Added a CI-enforced production-surface audit for placeholder destinations,
  unfinished runtime copy, and empty click handlers.
- Added a CI-enforced runtime import-graph audit, with the AI evaluation helper
  explicitly kept as a test-scoped module.
- Added a CI-enforced deployable-code secret scan for private keys and common
  provider credential formats.
- Added a dry-run-first expired-record maintenance command for auth sessions,
  verification tokens, and shared rate-limit buckets.
- Added focused Stripe plan, status-normalization, configuration, and callback
  URL coverage so billing guards are tested without enabling live checkout.
- Added the repository CI workflow badge to the README while keeping its remote
  green status as an explicit release verification gate.
- Added an optional provider-neutral error-monitoring webhook with bounded
  payloads, HTTPS production validation, and a 1.5-second fail-open timeout.
- Extended the monitoring adapter to receive classified generation, export,
  auth, and Stripe route failures without forwarding private payloads.
- Added a rate-limited client error-boundary endpoint that forwards only
  validated framework digests, keeping browser-rendering failures observable
  without sending exception messages or document content.
- Added dry-run-first retention for generation and product-event telemetry so
  operational records older than 180 days do not grow without bound.
- Added request-correlated telemetry for dashboard and document-workspace
  server fallbacks without forwarding exception messages or user content.
- Removed production landing-page links to the internal brand lab when that
  comparison surface is disabled, preventing customer-facing dead routes.
- Extended deployment verification to check the landing-page HTML for internal
  brand-lab links in addition to probing the disabled routes.
- Removed the five unreferenced starter SVG assets from the production public
  surface.
- Added an enterprise-styled global not-found page with safe recovery links so
  unknown routes do not fall back to framework-default chrome.
- Documented the preferred Chromium executable variable and legacy Puppeteer
  fallback so export deployments do not drift from the runtime contract.
- Extended deployment verification to smoke the public landing/pricing pages
  and enterprise 404 response, including request correlation, security headers,
  and framework-default error-content rejection.
- Made industry selectors and removable multi-select values keyboard-operable
  without changing the enterprise generation-form presentation.
- Removed the build-time Google Fonts fetch so production builds remain
  reproducible when external font hosts are unavailable; the enterprise UI
  keeps its system-sans fallback.
- Replaced stale public-surface copy with a runtime current-year footer and a
  precise README readiness boundary.
- Removed raw user identifiers from NextAuth sign-in event logs and added a
  readiness regression contract for account-safe operational logging.
- Gated the internal visual-direction lab behind `BRAND_LAB_ENABLED` so
  production deployments preserve the selected enterprise surface by default.
- Extended bounded operational telemetry to document CRUD, sharing, duplication,
  version-history, and profile route failures without forwarding document data.
- Added a CI-enforced operational telemetry audit so API routes that log errors
  cannot bypass the bounded monitoring adapter.
- Extended deployment verification with an optional production brand-lab probe
  for both the index and dynamic option route, so customer-facing smoke checks
  prove the enterprise surface is protected; CI and the runtime image now pin
  that gate disabled explicitly.
- Removed the unused legacy field-specific prompt-template module so prompt
  behavior has one active implementation path.
- Added an evidence-backed employer case study that documents the architecture,
  reliability decisions, local verification, and explicit hosted release gates.

### Release boundary

- Stripe billing remains disabled by default until a real test-mode checkout,
  portal, webhook, and subscription synchronization flow is verified.
- Hosted MongoDB, OpenRouter, SMTP, Chromium, deployment, and live-browser
  verification remain environment-specific release gates.
- Tightened the deployment verifier to reject readiness responses without a
  verifiable build version and commit, preventing an unknown-provenance release
  from passing the production smoke gate.
- Aligned the Playwright web-server callback URL with the local E2E base URL so
  deterministic browser tests do not boot with an invalid non-local callback
  host.
- Made deployment verification reject non-loopback HTTP targets; hosted release
  checks now require HTTPS transport while local loopback smoke remains supported.
- Made health probes reject redirects instead of following them, keeping
  readiness evidence bound to the verified deployment origin.
- Made production readiness fail closed when release version or commit
  provenance is missing/unknown; local E2E and CI/container smoke now supply
  explicit metadata, and unversioned container builds no longer look ready.
- Pinned Prisma-backed server-rendered pages to the Node runtime so MongoDB and
  authentication work cannot drift onto an incompatible route runtime.
- Added a readiness contract for the production component inventory, keeping
  superseded generation modules removed while preserving the intentional lazy
  form/editor boundaries.
