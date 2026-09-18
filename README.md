### PitchGenie

AI-powered pitch decks and proposals in minutes. PitchGenie helps founders, sales teams, and consultants generate compelling documents, export them to PDF/DOCX, and track usage—all with a clean Next.js 15 app router stack.

— In Progress — This project is actively evolving. Some features and docs may change.


### Features

- **Auth with email + password** using NextAuth Credentials and Prisma
- **AI-assisted generation** of pitch decks and proposals via a pluggable AI service
- **Export** generated docs to PDF/DOCX
- **Stripe billing scaffold** (checkout, portal, and signed webhook routes are guarded and disabled by default until end-to-end verification)
- **Modern UI** built with Tailwind and Radix UI
- **Robust tests** with Jest (API, integration, performance, security)


### Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Auth**: NextAuth (Credentials), Prisma adapter
- **DB**: Prisma + MongoDB (local or hosted)
- **Styling**: Tailwind CSS, Radix UI primitives
- **Payments**: Stripe integration scaffold (explicitly disabled by default in the current release)
- **AI**: `ai` SDK with OpenAI provider (via `@ai-sdk/openai`)
- **Testing**: Jest, Testing Library, Supertest, MSW, Playwright, and axe accessibility smoke checks


### Project Structure

Key areas in the repository:

- `app/` — routes, API endpoints, and pages (App Router)
- `components/` — shared UI and feature components
- `lib/` — services, utilities, Prisma client, Stripe, auth helpers
- `prisma/` — Prisma schema and generated client configuration
- `__tests__/` — comprehensive test suites (API, integration, perf, security)


### API Surface (selected)

- `app/api/auth/[...nextauth]/route.ts` — NextAuth handlers
- `app/api/auth/register/route.ts` — email/password registration
- `app/api/account/profile/route.ts` — authenticated profile updates
- `app/api/generate/pitch-deck/route.ts` — AI pitch deck generation
- `app/api/generate/proposal/route.ts` — AI proposal generation
- `app/api/documents/*` — ownership-scoped document CRUD and version history
- `app/api/export/pitch-deck/[id]/route.ts` — export pitch deck
- `app/api/export/proposal/[id]/route.ts` — export proposal
- `app/api/stripe/*` — guarded checkout, portal, and signed webhook routes (disabled unless explicitly enabled)


### Getting Started

1) Install dependencies

```bash
pnpm install
```

2) Configure environment variables

Copy `.env.example` to `.env.local` and replace every required placeholder. The
application uses MongoDB in every environment; use a local MongoDB instance or
a hosted cluster such as MongoDB Atlas.

```bash
# Required
DATABASE_URL="mongodb://127.0.0.1:27017/pitchgenie"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
OPENROUTER_API_KEY="your-openrouter-key"
AI_COST_PER_MILLION_TOKENS="" # Optional blended paid-model rate per million tokens
APP_VERSION="0.1.0" # Optional release identifier shown by readiness checks
HEALTHCHECK_EXTERNAL_SERVICES="false" # Set true to probe provider APIs from readiness checks
HEALTHCHECK_EXPORT_RUNTIME="false" # Set true to verify Chromium before advertising readiness
RATE_LIMIT_STORE="process" # Set mongodb for shared rate limits and usage reservations
HEALTHCHECK_DATABASE_INDEXES="false" # Set true to verify Prisma-managed Mongo indexes at readiness

# Optional SMTP magic links
EMAIL_SERVER_HOST="smtp.example.com"
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=""
EMAIL_SERVER_PASSWORD=""
EMAIL_FROM="noreply@example.com"

# Optional billing configuration (disabled unless the explicit flag is true)
STRIPE_BILLING_ENABLED="false"
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRO_PRICE_ID=""
STRIPE_ENTERPRISE_PRICE_ID=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
```

3) Initialize the database

```bash
pnpm db:generate
pnpm db:push
```

4) Run the dev server

```bash
pnpm dev
```

Open `http://localhost:3000` to use the app.


### Auth Model

- Email + password sign-up via `app/api/auth/register/route.ts`
- Session management via NextAuth; `credentials` provider is used for login
- Prisma stores hashed passwords with `bcryptjs`


### Scripts

```bash
pnpm dev                 # Run development server
pnpm build               # Build for production
pnpm start               # Start production server
pnpm lint                # Lint
pnpm typecheck           # TypeScript check

# Testing
pnpm test                # All tests
pnpm test:watch          # Watch mode
pnpm test:coverage       # Coverage
pnpm test:api            # API tests
pnpm test:integration    # Integration tests
pnpm test:performance    # Performance tests
pnpm test:security       # Security-focused tests
pnpm exec playwright install chromium
pnpm test:e2e             # Chromium journeys, PDF/mobile smoke, quota/ownership checks, and desktop/mobile serious/critical axe checks
pnpm eval:ai              # Deterministic AI quality fixture harness

# Prisma
pnpm db:generate
pnpm db:push
pnpm db:deploy           # Alias for MongoDB schema synchronization
pnpm db:studio
```


### Testing Notes

- Tests are located under `__tests__/` with focused suites for API, security, integration, and performance
- Jest config: `jest.config.js`; setup: `jest.setup.js`
- AI quality fixtures and deterministic regression checks live in `evals/`; run `pnpm eval:ai` before changing prompt contracts.


### Deployment

- Build with `pnpm build` and run with `pnpm start`
- Configure environment variables (see `.env.example`) on your hosting provider
- Production builds require `DATABASE_URL`, an HTTPS `NEXTAUTH_URL`, a
  32-character `NEXTAUTH_SECRET`, and `OPENROUTER_API_KEY`; the build fails
  fast when these are missing
- Use a hosted MongoDB cluster and verify its network/IP allow-list before deployment
- Set `RATE_LIMIT_STORE=mongodb` in production or any multi-instance deployment. In
  that mode, generation usage is reserved with a conditional MongoDB update so
  concurrent requests cannot oversubscribe finite plans; failed generations
  release their reservation.
- PDF exports require a Chromium executable. The server uses `playwright-core`,
  so set `CHROMIUM_EXECUTABLE_PATH` to the deployment's Chromium binary and
  verify this in the target hosting environment.
- The current CI workflow validates install, the production dependency audit, Prisma generation, lint, typecheck, Jest, build, a production-server smoke test with Chromium export-runtime readiness enabled, and the desktop/mobile Chromium + axe browser suite. CI uses a deterministic AI fixture and never calls the external provider.
- Stripe checkout, portal, and webhook routes are guarded by `STRIPE_BILLING_ENABLED`; leave it false until test-mode checkout, portal, webhook delivery, and subscription synchronization have been verified
- Deployment sequencing, readiness probes, failure triage, and rollback are documented in [`docs/PRODUCTION_RUNBOOK.md`](docs/PRODUCTION_RUNBOOK.md)


### In Progress

- Ongoing improvements to the AI templates and exports
- Expanded test coverage and performance tuning
- UX refinements across generation flows


### License

Proprietary. All rights reserved unless otherwise noted.
