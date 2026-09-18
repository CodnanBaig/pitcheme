# PitchGenie baseline audit

Updated: 2026-09-18

## Passing local gates

The repository now has a repeatable local baseline with the lockfile installed:

```text
pnpm install --frozen-lockfile       PASS
pnpm db:generate                    PASS
pnpm db:deploy                      PASS (local MongoDB `pitchgenie-ci`)
pnpm exec jest --runInBand --silent  PASS (40 suites, 246 tests)
pnpm lint                           PASS
pnpm typecheck                      PASS
pnpm build                          PASS
pnpm test:ci                         PASS (246 tests; coverage report generated)
pnpm test:e2e                        PASS (20 Chromium tests; 10 serious/critical axe checks across desktop/mobile variants of 7 routes, plus mobile workspace smoke, cross-user ownership isolation, and free-plan quota enforcement)
pnpm eval:ai                         PASS (18 deterministic checks)
pnpm audit --prod                    PASS (no known vulnerabilities)
```

The current coverage report is a diagnostic rather than a release threshold:
48.63% statements, 48.61% branches, 39.56% functions, and 49.62% lines. The
planned 75%+ baseline is not met because most page components and service
integrations do not yet have meaningful tests.

The production build was verified with a MongoDB-style `DATABASE_URL`, a long
`NEXTAUTH_SECRET`, an HTTPS `NEXTAUTH_URL`, and a placeholder OpenRouter key.
Those production-shaped variables must be present whenever `pnpm build` runs;
the application intentionally fails fast when required runtime configuration is
missing. The successful build does not prove that a remote MongoDB cluster,
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
Prisma-managed MongoDB indexes healthy. The Playwright stage supplied that
executable explicitly to the PDF renderer for the PDF checks.

A real browser smoke was run against the same built server: the home page,
pricing page, and signup page rendered meaningful content with no Next.js error
overlay; pricing showed the intentionally disabled billing state; and an
unauthenticated dashboard visit redirected to `/auth/signin`. A second local
development smoke against an isolated MongoDB database registered a fresh
credentials account, signed in to the dashboard, opened the account menu, and
signed out back to `/auth/signin`. The portable Playwright suite now repeats
the protected-route, invalid/valid credentials, account-menu/sign-out, and
disabled-pricing checks in Chromium. The suite also runs deterministic proposal
and pitch-deck generation journeys, local proposal and pitch-deck PDF response
checks through the CI Chromium executable, proposal DOCX archive output, proposal edit/version/search/filter/
duplicate/delete coverage,
cross-user ownership isolation for view/export/delete boundaries, plus
serious/critical axe checks for the public, pricing, auth, and authenticated
workspace pages on desktop and Pixel 5 mobile. A separate mobile Chromium
project verifies viewport fit and
authenticated workspace navigation; real-provider and deployed export-runtime
checks remain outside this smoke suite.

With `HEALTHCHECK_EXPORT_RUNTIME=true` and an explicit
`CHROMIUM_EXECUTABLE_PATH`, the built server's readiness probe also returned
healthy for the local Chromium executable. Deployment verification remains a
separate release gate.

## Baseline decisions

- MongoDB is the Prisma datasource of record. New setup instructions use a
  MongoDB connection string; the old SQLite file is retained temporarily as a
  tracked cleanup item so its removal can be reviewed separately.
- Credentials auth is available without SMTP. The email provider is added only
  when all SMTP credentials are configured.
- Credentials auth uses NextAuth JWT sessions, which is required by NextAuth;
  the Prisma adapter still persists users and accounts.
- CI uses placeholder secrets and never calls external AI, SMTP, or Stripe
  APIs. Its quality job now audits production dependencies, starts an ephemeral
  MongoDB service, applies the Prisma schema, runs the local gates against that
  service, installs Chromium before smoke testing, passes its executable path
  into the built production server, verifies live/ready/pricing routes with the
  export-runtime readiness probe enabled, prepares a separate MongoDB database
  for browser data, and runs the portable Playwright smoke suite with failure
  artifacts.
- The local Playwright web server performs the same `pnpm db:deploy` schema and
  index synchronization against `E2E_DATABASE_URL` before starting, so quota,
  ownership, and rate-limit smoke tests exercise MongoDB constraints rather
  than an unindexed ad-hoc database.
- Production builds no longer bypass linting; `pnpm build` and CI both enforce
  the same lint/type/build contract. The repository uses ESLint 9 with its
  flat config so Next.js 15 can run build-time linting without the ESLint 8
  flat-config option mismatch.
- Export filenames are normalized to portable, path-safe names and browser
  cleanup runs even when PDF generation fails.
- Exported proposal and pitch-deck HTML escapes interpolated text and sanitizes
  model-generated slide markup before it reaches the PDF renderer.
- Export routes use `playwright-core` and require `CHROMIUM_EXECUTABLE_PATH` for
  deployments that provide Chromium outside the package install. The former
  `PUPPETEER_EXECUTABLE_PATH` name remains a compatibility fallback.
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
  type-checked, and placeholder/underspecified briefs are rejected before usage
  reservation or provider calls.
- Server-rendered pitch-deck markup is sanitized before it reaches the browser,
  and authentication event logs record only a user ID/provider instead of the
  full account object.
- HTTP responses now include a baseline Content-Security-Policy and production
  HSTS alongside the existing frame, content-type, referrer, and permissions
  protections.
- Credentials sign-in normalizes email addresses and applies a bounded login
  guard outside tests. Set `RATE_LIMIT_STORE=mongodb` to use the atomic shared
  MongoDB bucket across instances; local/CI defaults remain process-local.
- Health checks expose a dependency-free `/api/health/live` probe plus the
  dependency-aware `/api/health` and `/api/health/ready` readiness probes.
  Set `HEALTHCHECK_EXTERNAL_SERVICES=true` to enable cached, timeout-bounded
  OpenRouter and Stripe API probes; local and CI defaults remain configuration-only.
  Set `HEALTHCHECK_EXPORT_RUNTIME=true` to make readiness verify that the
  Chromium executable required for PDF export exists.
  Readiness responses also expose a sanitized application version and build
  commit identifier when the deployment supplies one.
- Registration, generation, and export endpoints have bounded rate guards with
  `429` responses and an optional atomic MongoDB-backed store for production
  clusters.
- When `RATE_LIMIT_STORE=mongodb`, generation routes reserve finite-plan usage
  with a conditional MongoDB update and release the reservation when generation
  fails, preventing concurrent instances from oversubscribing monthly limits.
- Generation endpoints also allow only one in-flight generation per user per
  process, preventing duplicate expensive provider calls while a request is
  still running.
- AI generation now has a 45-second provider timeout and rejects empty or
  oversized output before persisting a document.
- Retryable AI provider failures receive one bounded retry with exponential
  backoff before the configured fallback model is attempted; authentication and
  validation failures fail over immediately.
- Server-side failure logs record only a safe error class/name; request payloads,
  generated documents, provider messages, and stack details are not emitted.
- Each started generation now receives a safe request ID and writes a durable
  MongoDB `Generation` record with provider/model, total tokens, latency,
  prompt version, repair state, completion status, estimated cost when
  configured, and a non-sensitive error category. Free model aliases record
  zero cost; paid-model estimates use the optional blended rate. Tracking
  failures are logged without blocking the user response.
- Generation and export responses return the request ID in JSON or
  `X-Request-ID` headers so operational failures can be correlated without
  logging document payloads.
- Protected browser API helpers now surface structured server validation and
  usage-limit messages to the generation forms instead of collapsing every
  non-2xx response into a generic status error.
- Proposal and standard pitch-deck prompts now request versioned JSON output;
  shape validation and one repair pass run before the renderer-compatible
  normalizer, with a controlled legacy-text fallback for older/provider
  responses and repair state persisted in metadata.
- The document workspace now has ownership-scoped list, edit, duplicate, and
  delete APIs plus working search, type/date filters, sort, bounded pagination,
  download, and edit controls.
- Document edits now create ownership-scoped MongoDB version snapshots, with
  history listing and restore controls in the editor.
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
- Stripe checkout and portal sessions, signed webhook verification, subscription
  synchronization, payment-failure state transitions, and billing UI actions are
  implemented behind `STRIPE_BILLING_ENABLED=false` by default.

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

## Remaining release blockers

- Stripe billing still needs real test-mode products, webhook delivery, and a
  completed checkout/portal/cancellation rehearsal before paid-plan claims can
  be enabled. The application remains safely disabled by default.
- Live provider probes are opt-in and were not exercised in this local run; a
  deployed environment still needs them enabled and verified with real provider
  credentials.
- Basic request and output sanity validation, structured generation validation
  with one repair pass, document CRUD, editor persistence, debounced autosave,
  version restore, process-local rate guards, request-correlated generation
  tracking, deterministic AI evaluation, guarded Stripe billing, an optional
  shared limiter/usage reservation mode, and a portable Chromium smoke suite
  with deterministic proposal/pitch-deck journeys, cross-user ownership
  isolation, and free-plan quota enforcement are now present. Section
  regeneration, external error monitoring, real-provider generation, and the
  deployed export-runtime E2E journey are not complete.
- The tracked `prisma/dev.db` artifact should be removed in a dedicated cleanup
  change after confirming no local workflow depends on it.
- PDF export still needs a real deployed Chromium smoke test; the local install
  intentionally has no bundled browser because the export runtime uses
  `playwright-core` and an explicit executable path.
- Keep the deployment-provided Chromium path explicit and review browser-runtime
  dependency updates as part of each release.
