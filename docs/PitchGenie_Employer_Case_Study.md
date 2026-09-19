# PitchGenie — engineering case study

## The product

PitchGenie turns a structured client brief into an editable proposal or pitch
deck. The experience keeps an enterprise visual language—navy, cloud, and teal,
with restrained motion and clear information hierarchy—while the server owns
generation, document persistence, usage accounting, and export rendering.

This repository is a production-minded prototype. It is designed to be
reviewable and runnable without pretending that a hosted provider, billing
account, or live demo has already been verified.

## Architecture

```text
Browser
  -> Next.js App Router and protected workspace
  -> validated API routes (Node runtime, request IDs, bounded bodies)
  -> NextAuth credentials / optional email provider
  -> Prisma + MongoDB replica set
  -> usage and shared rate-limit guards
  -> OpenRouter structured-generation pipeline
  -> Playwright Chromium PDF or DOCX export
```

The main contracts are documented in the [production runbook](./PRODUCTION_RUNBOOK.md)
and the [readiness plan](./PitchGenie_Production_Readiness_Plan.md).

## Decisions that matter

### Structured generation instead of raw model text

Proposal and pitch-deck responses use versioned JSON contracts. The pipeline
normalizes and validates output, allows one bounded repair pass, then follows a
controlled legacy-text fallback. Invalid or incomplete output is never saved as
if it were successful.

### Consistent ownership and history

Owner-scoped document APIs query by the authenticated owner. Creates, edits,
duplicates, restores, versions, and dependent cleanup use MongoDB transactions
where consistency matters. Atomic usage reservations are released on failed
generation. ETag-style revisions turn a stale browser tab into a recoverable
conflict instead of silently replacing newer work.

### Bounded expensive work

Generation has request deadlines, retry/fallback limits, account and route
guards, and disconnect-aware streaming. PDF/DOCX export has per-account and
per-process concurrency limits, Chromium launch/render timeouts, safe filenames,
sanitized markup, and no-store responses.

### Privacy-aware operations

Request IDs connect API responses, logs, generation records, and product events.
Telemetry stores operational facts and ownership references, not prompts,
generated documents, credentials, bearer share tokens, or provider error text.
Share links are signed, expiring, revocable, and stored only by token hash.

### Deployment as a contract

Production configuration is validated at startup. Readiness checks cover the
MongoDB connection and required indexes, the AI configuration, Stripe state,
and the Chromium runtime. The multi-stage image installs the platform Prisma
engine and Chromium, removes development dependencies from the runtime layer,
and exposes a readiness-backed Docker healthcheck.

## Evidence

The current local quality gate reports:

- 73 Jest suites and 466 tests passing
- 69.35% statements, 60.66% branches, 65.40% functions, and 72.04% lines
- Four current default AI model roles verified against the live provider
  catalog; credential-backed generation remains a separate release check
- lint, TypeScript, production dependency audit, and deterministic AI evaluation passing
- production-shaped `pnpm build` passing, with built-server liveness, security
  headers, public routes, and all production-gated brand-lab paths smoke-tested
- deterministic Chromium smoke coverage for authentication, generation, editing,
  version conflicts/restores, ownership isolation, sharing, exports, mobile
  navigation, and serious/critical accessibility checks

The baseline audit records which checks are local evidence and which still need
hosted verification. A live URL, Stripe test purchase, real-provider latency
check, and deployment Chromium check are intentionally not claimed here.

## Two-minute explanation

> I built PitchGenie as an enterprise-styled document-generation workspace. The
> browser submits a bounded, validated brief; a structured AI pipeline validates
> and repairs the provider response before it is persisted. Atomic usage
> reservations and MongoDB transactions keep accounting and document version
> history consistent. The
> application adds request correlation, privacy-safe telemetry, ownership checks,
> signed share links, bounded exports, and readiness-backed container deployment.
> The test suite proves the critical local journeys, while the remaining release
> work is deliberately separated into hosted provider, billing, Chromium, and
> live-deployment gates.

## Next release gates

1. Run the full CI workflow on the target branch and publish the tagged image.
2. Apply the MongoDB schema/index bootstrap against the hosted replica set.
3. Verify `/api/health/live`, `/api/health/ready`, and
   `pnpm verify:deployment` against the deployment URL.
4. Run a fresh-browser authenticated smoke with the real AI provider and
   deployment Chromium.
5. Enable Stripe only after test-mode checkout, portal, webhook delivery, and
   subscription synchronization are observed end to end.
