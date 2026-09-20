# PitchGenie production runbook

This runbook covers a production-shaped deployment of the current prototype.
The enterprise visual system is part of the application contract; deployment
changes should not replace it with provider-default styling.

## Required services

- MongoDB (hosted replica set, with the deployment network/IP allow-list
  configured)
- OpenRouter credentials for live generation, or explicit portfolio demo mode
  for deterministic, provider-free generation
- A Node runtime that can run Next.js and a Chromium executable for PDF export

Stripe billing is disabled by default. Do not advertise paid checkout until the
explicit flag is enabled and test-mode checkout, portal, webhook delivery, and
subscription synchronization have been verified end to end.

## Environment

Required in production:

```text
DATABASE_URL=mongodb://...?replicaSet=<replica-set-name>
NEXTAUTH_URL=https://your-domain.example
NEXTAUTH_SECRET=<at least 32 random characters>
OPENROUTER_API_KEY=<provider key, optional when PORTFOLIO_DEMO_MODE=true>
PORTFOLIO_DEMO_MODE=false
APP_VERSION=<immutable release identifier>
BUILD_SHA=<commit identifier, unless the platform supplies one>
STRIPE_BILLING_ENABLED=false
RATE_LIMIT_STORE=mongodb
HEALTHCHECK_EXPORT_RUNTIME=true
HEALTHCHECK_DATABASE_INDEXES=true
```

The runtime validator rejects non-MongoDB URLs and standalone `mongodb://`
connections in production. Use a hosted replica set or include
`?replicaSet=<name>` in the connection string; MongoDB SRV URLs are accepted
for hosted replica sets. It also requires `RATE_LIMIT_STORE=mongodb` in
production so rate limits and finite-plan usage reservations remain shared
across instances; `process` is intended only for local development. Production
also requires `HEALTHCHECK_EXPORT_RUNTIME=true` and
`HEALTHCHECK_DATABASE_INDEXES=true` so readiness verifies the PDF runtime and
required MongoDB indexes before traffic is enabled.

`ERROR_MONITORING_WEBHOOK_URL` is optional but recommended for preview and
production. When configured, framework-level failures, client error-boundary
reports, and classified failures from generation, export, auth, Stripe,
profile, document, sharing, and version-history routes are forwarded as bounded JSON
containing only request IDs, route context, categories, and error classes.
Delivery is best-effort, capped at 1.5 seconds, and never blocks the original
request.

Set `CHROMIUM_EXECUTABLE_PATH` for the deployment's Chromium binary. The older
`PUPPETEER_EXECUTABLE_PATH` name remains a compatibility fallback only; do not
use it for new deployment configuration. Vercel deployments use the bundled
`@sparticuz/chromium` runtime automatically when neither path is configured.

`BRAND_LAB_ENABLED` defaults to disabled in production. Keep it unset or set to
`false` for customer-facing deployments so the internal visual-direction
comparison routes cannot expose non-enterprise alternatives. Enable it only in
an isolated design environment when those routes are intentionally needed.

Keep `E2E_TEST_MODE` unset in preview and production. The validator permits the
deterministic fixture provider only when the callback URL is an explicit local
`http://localhost` or `http://127.0.0.1` address; any real HTTPS deployment with
that flag is rejected before authenticated routes can start.

For portfolio-only deployments without provider credentials, set
`PORTFOLIO_DEMO_MODE=true` and keep `E2E_TEST_MODE` unset. Proposal and pitch-deck
creation then use deterministic, input-aware output, the health check reports
the demo provider explicitly, and no external AI request is attempted. Keep
this flag disabled for customer-facing production products.

The reviewed model defaults can be changed without a code release when a
provider model is deprecated or a deployment has an approved model policy:
`OPENROUTER_PRIMARY_MODEL`, `OPENROUTER_FALLBACK_MODEL`,
`OPENROUTER_LIGHTWEIGHT_MODEL`, and `OPENROUTER_VISUAL_MODEL`. Overrides are
bounded, whitespace-free identifiers; leave them blank to use the repository
defaults. Re-run the deterministic AI evaluation and the opt-in provider smoke
before promoting a model change:

```bash
pnpm eval:ai
pnpm smoke:provider -- --all-models
```

The provider smoke validates every configured model role against OpenRouter's
live catalog and performs a minimal generation against each unique model. It
uses `OPENROUTER_API_KEY` from the environment and never prints the credential
or provider response body. The ordinary command, `pnpm smoke:provider`,
generates only with the primary model and is suitable for a routine pre-release
check.

Recommended production settings:

```text
APP_VERSION=<immutable release identifier>
ERROR_MONITORING_WEBHOOK_URL=https://monitoring.example.com/events
RATE_LIMIT_STORE=mongodb
HEALTHCHECK_EXTERNAL_SERVICES=true
HEALTHCHECK_EXPORT_RUNTIME=true
HEALTHCHECK_DATABASE_INDEXES=true
CHROMIUM_EXECUTABLE_PATH=/path/to/chromium
```

When billing is approved for a test-mode deployment, set
`STRIPE_BILLING_ENABLED=true` and provide `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, and
`STRIPE_ENTERPRISE_PRICE_ID`. The webhook endpoint is
`/api/stripe/webhook`; Stripe signature verification is mandatory.

`RATE_LIMIT_STORE=mongodb` enables shared rate limits and atomic monthly usage
reservations; failed generations release against the reservation's original
month, including requests that run across month-end. Runtime validation rejects unknown values for the operational
feature flags, model overrides, cost-rate, SMTP port, and rate-limit store
instead of silently falling back. If the shared bucket cannot be reached,
guarded requests fail closed with a retryable rate-limit response instead of
falling back to an independent process-local bucket. `HEALTHCHECK_EXPORT_RUNTIME=true` makes readiness fail when the
configured Chromium path is missing, not a regular file, or not executable.
`HEALTHCHECK_DATABASE_INDEXES=true` makes
readiness verify the Prisma-managed unique and query indexes needed by usage,
rate-limit, document workspace ownership/type/date queries, document-share
lifecycle analytics, product-event telemetry, and generation tracking paths.
Keep external probes off
in local development and CI unless the provider calls are intentionally being
tested.

The shared limiter prunes buckets whose reset window has expired at most once
per minute per application instance. This keeps login and generation limiter
storage bounded without making cleanup a dependency of an individual request;
the request guard still fails closed if its atomic bucket operation is
unavailable.

External readiness probes are cached for 30 seconds and simultaneous requests
for the same provider share one in-flight probe. This prevents a readiness
stampede when a load balancer checks multiple application instances at once.

Generation routes allow 10 attempts per route per minute and 20 attempts per
account per hour. The hourly bucket is shared by proposals and pitch decks, and
streaming generation reuses the same guards through its underlying route. JSON
generation bodies are capped at 64 KB, individual text values at 10,000
characters, collections at 50 items, and nested payloads at 32 levels. A 429
response includes `Retry-After`; tune the policy in code only alongside
abuse-review evidence and corresponding tests.

Document exports are also bounded per application instance: one export per
account and at most two concurrent exports across the instance. The guard is
process-local and complements the shared request limiter; scale-out still
requires the distributed rate-limit store. A capacity response is retryable
and includes `Retry-After: 5` rather than starting another Chromium process.
Chromium startup is capped at 10 seconds and each HTML/PDF render operation is
capped at 20 seconds, leaving headroom inside the 60-second route budget.
Disconnected export requests propagate cancellation into HTML rendering; PDF
and DOCX work checks the signal before and after expensive operations and
returns a retry-safe `499` response while always releasing browser capacity.

Before quota reservation or provider work, generation validation rejects
high-confidence requests to create credential theft or malware tooling while
allowing defensive security and compliance briefs. This is a narrow abuse
control, not a substitute for provider moderation or a broader safety policy.

Every Prisma-backed API handler explicitly targets the Node runtime. CRUD,
profile, share, authentication, Stripe, and readiness handlers request a
bounded 10- or 30-second function budget, while generation, streaming, and PDF
export handlers request 60 seconds on hosts that honor Next.js route duration
settings. Provider retries, repairs, and model fallbacks share a 55-second
request deadline. Confirm the deployed plan permits those durations and keep
the provider timeout, reverse-proxy timeout, and client abort behavior aligned.

The proposal and pitch-deck forms use `/api/generate/proposal/stream` and
`/api/generate/pitch-deck/stream` for server-sent generation stages and provider
text deltas. These transports reuse the ordinary generation route underneath,
so authentication, request caps, quotas, fallback, validation, persistence, and
request-correlated failures remain identical. Reverse proxies must allow
`text/event-stream` responses without buffering; the endpoints send
`Cache-Control: no-store, no-transform` and `X-Accel-Buffering: no` for that
purpose. Consumer cancellation propagates an abort signal to the provider and
suppresses fallback retries, preventing disconnected browser tabs from
continuing billable work. The non-streaming JSON routes remain available for
API clients. Wrapped route responses cap their response reader at 1 MiB, while
authenticated JSON clients allow up to 2 MiB for the largest editable document;
oversized payloads fail closed instead of being parsed into unbounded memory.

Document owners can issue read-only share links from the document view. Links
are HMAC-signed with `NEXTAUTH_SECRET`, contain no document content, expire after
seven days, and render through the same generated-HTML sanitizer as the private
view. Only a SHA-256 token hash and lifecycle metadata are stored; the raw bearer
token is returned once and is never logged. Treat a share link as a bearer
credential; do not paste it into logs or support tickets. Owners can revoke all
active links for a document, and the owner-scoped analytics response reports
link expiry, revocation state, and aggregate view counts. Deleting the source
document also removes its share records.
The current `v2` token format includes a random nonce so links issued by an
older stateless build are intentionally not accepted after this rollout; issue
new links after deployment.

Set `HEALTHCHECK_MODEL_CATALOG=true` alongside
`HEALTHCHECK_EXTERNAL_SERVICES=true` in a provider-backed deployment to make
readiness verify that every configured model role is present in the provider
catalog. This catches model deprecations before traffic is enabled without
returning the provider response or model IDs in health output.

The signed Stripe webhook accepts raw payloads up to 1 MiB. Larger payloads are
rejected before signature verification; Stripe should retry only after the
event has been reduced or the deployment limit has been deliberately reviewed.
Stripe SDK requests use a 10-second timeout and at most two network retries so
checkout, portal, and webhook calls stay within the application request budget.
Verified events are recorded in the durable `StripeWebhookEvent` ledger before
business processing. Completed duplicate deliveries are acknowledged without
repeating subscription mutations; deliveries that overlap active processing get
a retryable response, and stale claims are reclaimed atomically after five
minutes. Failed events remain retryable on the next delivery. Subscription
updates reconcile metadata, customer, and subscription ownership references;
conflicting references are rejected without mutating a local account. Reads of
legacy or malformed subscription rows degrade to the free/non-active state
until a verified Stripe event repairs them. Subscription mutations also carry
the Stripe event timestamp and ignore older events that arrive after newer
state, preventing out-of-order delivery from reactivating stale access.
When a subscription contains an unknown add-on alongside one configured paid
price, the configured plan is selected; multiple configured paid plans are
treated as ambiguous and do not grant access.

State-changing custom API requests are rejected when an explicit browser
`Origin` or `Referer` points to another origin. NextAuth-managed callbacks and
the Stripe webhook are exempt because they validate their own protocol-level
CSRF/signature contracts. Requests without browser-origin headers remain
available to server-to-server API clients.

## Deployment sequence

### Container deployment

The repository includes a production image for hosts that support OCI/Docker
containers. It installs Chromium inside the image and defaults the export
runtime probe to `/usr/bin/chromium`; secrets and the hosted MongoDB URL are
provided only at runtime.

Set `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` (or omit the variable) in the
runtime environment. Do not pass an empty value from `.env.production`, since
that would override the image default.

```bash
docker build --build-arg APP_VERSION=<release> --build-arg BUILD_SHA=<commit> -t pitchgenie .
docker run --env-file .env.production -p 3000:3000 pitchgenie
```

CI uses an explicit Docker Buildx builder and loads the image before the
container smoke test; this avoids relying on a runner's legacy `docker build`
implementation.

### Vercel deployment

Vercel uses the bundled `@sparticuz/chromium` binary for PDF exports and the
readiness probe. Leave `CHROMIUM_EXECUTABLE_PATH` and
`PUPPETEER_EXECUTABLE_PATH` unset there; the runtime resolves and extracts the
matching headless binary automatically. Keep `HEALTHCHECK_EXPORT_RUNTIME=true`
so a deployment cannot become ready when extraction or execution support is
unavailable.

The Dockerfile uses `corepack install` after copying `package.json`, so the
image resolves the integrity-qualified pnpm version declared by the repository
instead of activating a second unqualified version.

Tagged releases (`vMAJOR.MINOR.PATCH`) publish the same production image to
GitHub Container Registry through the gated `publish` job in
`.github/workflows/ci.yml`. The job runs only after the full `quality` job has
passed, uses the repository's `GITHUB_TOKEN`, embeds the tag and commit in
readiness provenance, and enables BuildKit provenance and SBOM attestations.
Publishing an image does not deploy it or enable billing/provider traffic; the
platform rollout must still run the readiness and hosted verification gates
below. Treat the versioned tag as immutable and roll back by redeploying the
previously verified image tag.

For release provenance, pass `--build-arg APP_VERSION=<release>` and
`--build-arg BUILD_SHA=<commit>` to the image build. Readiness exposes the
sanitized values and fails closed when either value is missing or unknown, so
operators can correlate a healthy container with the intended rollout.

The image healthcheck calls `/api/health/ready`. Do not route traffic to a
container until that check reports healthy and the response confirms the
database indexes and export runtime are available.

Prisma requires MongoDB transactions for application writes, so the deployment
database must be a replica set (MongoDB Atlas provides this by default). For a
local single-node MongoDB, start `mongod` with `--replSet rs0 --bind_ip_all`,
initialize it once with `rs.initiate()`, and include `?replicaSet=rs0` in
`DATABASE_URL` before running the application or E2E suite.

Run these gates against the deployment configuration before traffic is enabled:

```bash
pnpm install --frozen-lockfile
pnpm audit --prod
pnpm db:generate
pnpm db:deploy           # schema sync plus idempotent collection/index bootstrap
pnpm db:migrate:versions  # dry run; reports documents without history
pnpm db:prune:expired     # dry run; reports expired auth/limit/telemetry records
pnpm lint
pnpm quality:imports
pnpm quality:secrets
pnpm quality:surface
pnpm quality:telemetry
pnpm typecheck
pnpm test:ci
pnpm build
pnpm start
```

If the dry run reports documents without version history, review the count and
run the idempotent backfill explicitly before enabling traffic:

```bash
MIGRATE_DOCUMENT_VERSIONS_CONFIRM=apply pnpm db:migrate:versions
```

Schedule `pnpm db:prune:expired` against the hosted replica set as a separate
maintenance task. It removes expired NextAuth sessions, expired verification
tokens, expired shared rate-limit buckets, and generation/product telemetry
older than 180 days. The default is a dry run; apply deletion only after
reviewing the counts:

```bash
PRUNE_EXPIRED_CONFIRM=apply pnpm db:prune:expired
```

The backfill records each document's current state as version 1 only when no
snapshot exists. It does not overwrite existing history; rerunning it is safe.
Run it from the release workspace (or a one-off migration job) with the same
production `DATABASE_URL`; it is intentionally separate from application boot.

Then verify:

```text
GET /api/health/live  -> 200
GET /api/health/ready -> 200 with database, AI, and export-runtime checks healthy
```

For a repeatable hosted release gate, verify both probes, correlation and
security headers, cache policy, and the image provenance from a deployment shell:

```bash
VERIFY_BASE_URL=https://your-domain.example \
EXPECTED_BUILD_SHA=<commit> \
pnpm verify:deployment
```

The verifier accepts only JSON health responses, rejects redirects from health
probes, and bounds every probe response at 256 KiB, so an HTML error page,
cross-route response, or unexpectedly large upstream response fails closed
instead of being treated as deployment evidence. It also checks the
public landing and pricing pages for HTML responses, correlation/security
headers, and framework-default error content, then confirms a customer-safe
404 response for an unknown route. Non-loopback URLs must use `https`; plain
HTTP is accepted only for local loopback smoke tests.

For customer-facing production checks, also set
`VERIFY_BRAND_LAB_DISABLED=true`. The verifier then requires the landing page
to contain no internal brand-lab links and requires `/brand-lab` plus all four
known option routes (`signal`, `editorial`, `enterprise`, and `operator`) to
return `404`, proving the internal visual-direction comparison routes are not
exposed by the deployment.

The command exits non-zero when either probe is unhealthy, readiness omits a
healthy database, AI, storage, or export-runtime check (or a valid runtime
environment), the response has no verifiable build version and commit, a
public page is not served with the expected enterprise security/correlation
contract, the 404 route falls back to framework-default content, a health
response is missing `X-Request-ID` or `Cache-Control: no-store`, or the
reported build commit/version does not match the expected release.

Record the `X-Request-ID` from health and generation/export responses when
handing a failure to the operator. Health responses are intentionally marked
`Cache-Control: no-store`.

## Failure triage

1. Check `/api/health/live` to separate process failure from dependency failure.
2. Check `/api/health/ready` and inspect only the named check that is unhealthy.
   The database probe is bounded and returns `Database probe timed out` when
   MongoDB cannot be reached promptly. If it reports missing indexes, run
   `pnpm db:deploy` against the deployment database and repeat readiness before
   enabling traffic. This command also materializes the expected collections and
   verifies the Prisma-managed indexes on a fresh empty database, including the
   Stripe customer/subscription lookup indexes used by webhook reconciliation.
3. Use the request ID to find the corresponding sanitized server log or
   `Generation` record. Generated document content and provider messages are not
   logged.
   If a browser error boundary is shown, include its incident reference with the
   request ID; the boundary intentionally does not display exception details.
4. For export failures, verify the Chromium path and runtime permissions before
   changing application code. Proposal Markdown tables are rendered as bounded
   styled PDF tables and native DOCX tables; malformed table syntax remains
   ordinary document text.
5. For usage or rate-limit anomalies, confirm the deployment uses the MongoDB
   store and that the `RateLimitBucket`/`Usage` collections are reachable.
   If the dashboard shows unavailable metrics, treat it as a database-read
   failure; do not interpret the placeholders as a zero-usage account.
   The documents workspace follows the same rule and disables its data controls
   while the read path is unavailable.

## Rollback

- Roll back the application deployment to the last known-good build.
- Keep the database available; do not delete document, usage, or generation
  records as part of an application rollback.
- Review any Prisma schema change separately before applying it to another
  environment. MongoDB synchronization and idempotent index bootstrap are
  performed with `pnpm db:deploy`.
- Re-run both health probes and a protected document/export smoke test after
  the rollback.

## Current release boundary

Local build, test, and readiness checks do not prove a live deployment, real AI
provider access, SMTP delivery, Stripe billing, Chromium availability, or
authenticated browser journeys. Those remain explicit release gates for the
hosting environment.
