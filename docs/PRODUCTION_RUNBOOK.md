# PitchGenie production runbook

This runbook covers a production-shaped deployment of the current prototype.
The enterprise visual system is part of the application contract; deployment
changes should not replace it with provider-default styling.

## Required services

- MongoDB (hosted, with the deployment network/IP allow-list configured)
- OpenRouter credentials for generation
- A Node runtime that can run Next.js and a Chromium executable for PDF export

Stripe billing is disabled by default. Do not advertise paid checkout until the
explicit flag is enabled and test-mode checkout, portal, webhook delivery, and
subscription synchronization have been verified end to end.

## Environment

Required in production:

```text
DATABASE_URL=mongodb://...
NEXTAUTH_URL=https://your-domain.example
NEXTAUTH_SECRET=<at least 32 random characters>
OPENROUTER_API_KEY=<provider key>
STRIPE_BILLING_ENABLED=false
```

Recommended production settings:

```text
APP_VERSION=0.1.0
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
reservations. `HEALTHCHECK_EXPORT_RUNTIME=true` makes readiness fail when the
Chromium executable is missing. `HEALTHCHECK_DATABASE_INDEXES=true` makes
readiness verify the Prisma-managed unique and query indexes needed by usage,
rate-limit, ownership, and generation tracking paths. Keep external probes off
in local development and CI unless the provider calls are intentionally being
tested.

## Deployment sequence

Run these gates against the deployment configuration before traffic is enabled:

```bash
pnpm install --frozen-lockfile
pnpm audit --prod
pnpm db:generate
pnpm db:deploy
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm build
pnpm start
```

Then verify:

```text
GET /api/health/live  -> 200
GET /api/health/ready -> 200 with database, AI, and export-runtime checks healthy
```

Record the `X-Request-ID` from health and generation/export responses when
handing a failure to the operator. Health responses are intentionally marked
`Cache-Control: no-store`.

## Failure triage

1. Check `/api/health/live` to separate process failure from dependency failure.
2. Check `/api/health/ready` and inspect only the named check that is unhealthy.
   If the database check reports missing indexes, run `pnpm db:deploy` against
   the deployment database and repeat readiness before enabling traffic.
3. Use the request ID to find the corresponding sanitized server log or
   `Generation` record. Generated document content and provider messages are not
   logged.
4. For export failures, verify the Chromium path and runtime permissions before
   changing application code.
5. For usage or rate-limit anomalies, confirm the deployment uses the MongoDB
   store and that the `RateLimitBucket`/`Usage` collections are reachable.

## Rollback

- Roll back the application deployment to the last known-good build.
- Keep the database available; do not delete document, usage, or generation
  records as part of an application rollback.
- Review any Prisma schema change separately before applying it to another
  environment. MongoDB synchronization is performed with `pnpm db:deploy`.
- Re-run both health probes and a protected document/export smoke test after
  the rollback.

## Current release boundary

Local build, test, and readiness checks do not prove a live deployment, real AI
provider access, SMTP delivery, Stripe billing, Chromium availability, or
authenticated browser journeys. Those remain explicit release gates for the
hosting environment.
