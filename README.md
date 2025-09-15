### PitchGenie

AI-powered pitch decks and proposals in minutes. PitchGenie helps founders, sales teams, and consultants generate compelling documents, export them to PDF/DOCX, and manage subscriptions—all with a clean Next.js 15 app router stack.

— In Progress — This project is actively evolving. Some features and docs may change.


### Features

- **Auth with email + password** using NextAuth Credentials and Prisma
- **AI-assisted generation** of pitch decks and proposals via a pluggable AI service
- **Export** generated docs to PDF/DOCX
- **Stripe billing** for checkout and customer portal
- **Modern UI** built with Tailwind and Radix UI
- **Robust tests** with Jest (API, integration, performance, security)


### Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Auth**: NextAuth (Credentials), Prisma adapter
- **DB**: Prisma + SQLite (dev); configurable for other databases
- **Styling**: Tailwind CSS, Radix UI primitives
- **Payments**: Stripe
- **AI**: `ai` SDK with OpenAI provider (via `@ai-sdk/openai`)
- **Testing**: Jest, Testing Library, Supertest, MSW


### Project Structure

Key areas in the repository:

- `app/` — routes, API endpoints, and pages (App Router)
- `components/` — shared UI and feature components
- `lib/` — services, utilities, Prisma client, Stripe, auth helpers
- `prisma/` — Prisma schema and local dev database
- `__tests__/` — comprehensive test suites (API, integration, perf, security)


### API Surface (selected)

- `app/api/auth/[...nextauth]/route.ts` — NextAuth handlers
- `app/api/auth/register/route.ts` — email/password registration
- `app/api/generate/pitch-deck/route.ts` — AI pitch deck generation
- `app/api/generate/proposal/route.ts` — AI proposal generation
- `app/api/export/pitch-deck/[id]/route.ts` — export pitch deck
- `app/api/export/proposal/[id]/route.ts` — export proposal
- `app/api/stripe/*` — checkout, portal, webhook


### Getting Started

1) Install dependencies

```bash
pnpm install
```

2) Configure environment variables

Create a `.env.local` at the project root and provide the following (adjust as needed):

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-strong-secret

# Database (Prisma)
DATABASE_URL=file:./dev.db

# AI Provider
OPENAI_API_KEY=your-openai-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

3) Initialize the database

```bash
pnpm db:generate
pnpm db:push
# or, when you need migrations:
pnpm db:migrate
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

# Testing
pnpm test                # All tests
pnpm test:watch          # Watch mode
pnpm test:coverage       # Coverage
pnpm test:api            # API tests
pnpm test:integration    # Integration tests
pnpm test:performance    # Performance tests

# Prisma
pnpm db:generate
pnpm db:push
pnpm db:migrate
pnpm db:studio
```


### Testing Notes

- Tests are located under `__tests__/` with focused suites for API, security, integration, and performance
- Jest config: `jest.config.js`; setup: `jest.setup.js`


### Deployment

- Build with `pnpm build` and run with `pnpm start`
- Configure environment variables (see above) on your hosting provider
- For Stripe webhooks, expose your dev server or configure production webhook to `app/api/stripe/webhook/route.ts`


### In Progress

- Ongoing improvements to the AI templates and exports
- Expanded test coverage and performance tuning
- UX refinements across generation flows


### License

Proprietary. All rights reserved unless otherwise noted.
