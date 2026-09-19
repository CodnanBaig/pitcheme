# PitchGenie Setup Guide

## Environment Variables Setup

Copy `.env.example` to `.env.local` and replace the placeholders. The Prisma
schema uses MongoDB in local, preview, and production environments.

Docker is not required when `DATABASE_URL` points to a reachable MongoDB Atlas
cluster. Use a database name in the URI (for example, `pitchgenie-e2e` for an
isolated browser rehearsal); Docker is only needed for the disposable local
replica set and the CI/reproducible production-container paths.

### Required Variables

```bash
# Database Configuration
DATABASE_URL="mongodb://127.0.0.1:27017/pitchgenie?replicaSet=rs0"

# NextAuth Configuration
NEXTAUTH_SECRET=replace-with-a-long-random-secret
# Absolute http(s) URL; production deployments must use https://
NEXTAUTH_URL=http://localhost:3000

# AI generation (required for generation routes)
OPENROUTER_API_KEY=your-openrouter-key

# Optional blended paid-model rate in USD per million tokens
AI_COST_PER_MILLION_TOKENS=

# Local release identifier shown by readiness checks; production must provide
# the immutable release value used to build the deployment.
APP_VERSION=0.1.0
# Production commit when the platform does not provide GIT_COMMIT_SHA or
# VERCEL_GIT_COMMIT_SHA automatically.
BUILD_SHA=

# Optional live provider probes (keep false for local/CI)
HEALTHCHECK_EXTERNAL_SERVICES=false

# Optional provider model-catalog check (requires external probes)
HEALTHCHECK_MODEL_CATALOG=false

# Optional export-runtime probe; set true in production to require Chromium
HEALTHCHECK_EXPORT_RUNTIME=false

# Optional MongoDB index probe; set true before production traffic
HEALTHCHECK_DATABASE_INDEXES=false

# Shared rate-limit store: mongodb enables distributed rate limits and atomic
# monthly usage reservations. Use process only for local-only development.
RATE_LIMIT_STORE=process

# Optional deployment-provided Chromium path for PDF exports
CHROMIUM_EXECUTABLE_PATH=
# Legacy compatibility alias; prefer CHROMIUM_EXECUTABLE_PATH for new deployments
PUPPETEER_EXECUTABLE_PATH=

# Optional bounded error-monitoring webhook for preview/production
ERROR_MONITORING_WEBHOOK_URL=

# Optional internal visual-direction comparison (keep disabled in production)
BRAND_LAB_ENABLED=false

# Email magic links (optional; credentials auth works without SMTP)
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-gmail@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password-or-password
EMAIL_FROM=noreply@example.com
```

Production runtime validation requires `RATE_LIMIT_STORE=mongodb`,
`HEALTHCHECK_EXPORT_RUNTIME=true`, and `HEALTHCHECK_DATABASE_INDEXES=true`;
the process-local value and disabled probes above are for local development
only.

### Optional Variables (for additional features)

```bash
# Stripe Configuration (keep disabled until test-mode verification is complete)
STRIPE_BILLING_ENABLED=false
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_PRO_PRICE_ID=price_your_pro_price
STRIPE_ENTERPRISE_PRICE_ID=price_your_enterprise_price
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
```

## Quick Start

Use Node.js 20 or newer and pnpm 10.12.1 (the version pinned by the
repository's package-manager contract).

1. **Install dependencies:**
   ```bash
   pnpm install --frozen-lockfile
   ```

2. **Set up the database:**
   ```bash
# Generate the Prisma client
   pnpm db:generate

   # Synchronize the MongoDB schema and required indexes
   pnpm db:deploy
   ```

3. **Generate a secure secret:**
   ```bash
   openssl rand -base64 32
   ```
   Use the output as your `NEXTAUTH_SECRET`

4. **Run the development server:**
   ```bash
   pnpm dev
   ```

5. **Smoke-test the real AI provider before promotion:**
   ```bash
   pnpm smoke:provider
   ```
   This opt-in command uses the configured OpenRouter credential, validates all
   configured model roles against the live catalog, and performs one minimal
   primary-model generation. Run `pnpm smoke:provider -- --all-models` after a
   model change to exercise each unique configured model. It is intentionally
   excluded from ordinary CI because it requires a real secret and makes live
   provider calls.

## Database Setup

This project uses MongoDB through Prisma. A local MongoDB server is convenient
for development; a hosted MongoDB cluster is recommended for preview and
production. Prisma migrations are not used for this MongoDB datasource. The
database must run as a replica set because application writes use transactions;
`pnpm db:deploy` synchronizes the schema and idempotently bootstraps required
indexes.

### Database Management
```bash
# View your database in a browser
pnpm db:studio

# Synchronize the MongoDB schema and required indexes
pnpm db:deploy
```

## Authentication Providers

Credentials email/password authentication is always available. Email magic
links are enabled only when all SMTP variables are configured. Google OAuth is
not enabled in the current provider list, so do not add Google callback URLs
unless the provider is deliberately implemented and tested.

## Email Authentication Setup

The application supports email magic links when SMTP is configured. Credentials
email/password authentication remains available without SMTP:

### Gmail (Recommended for Development)
1. Enable 2-factor authentication on your Gmail account
2. Generate an app password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
3. Use your Gmail address and app password in the environment variables:
   ```bash
   EMAIL_SERVER_USER=your-gmail@gmail.com
   EMAIL_SERVER_PASSWORD=your-16-character-app-password
   ```

### Other Email Providers
You can also use services like:
- **SendGrid**: Set `EMAIL_SERVER_HOST=smtp.sendgrid.net`
- **Mailgun**: Set `EMAIL_SERVER_HOST=smtp.mailgun.org`
- **AWS SES**: Configure with your SMTP credentials

### Testing Email Authentication
1. Configure all SMTP variables in `.env.local`.
2. Start the development server.
3. Request a magic link from the sign-in page.
4. Confirm the link arrives and completes the session.

## Stripe Setup (Optional, staged)

Stripe routes are guarded and disabled by default in the current release. Do
not advertise paid checkout or collect payment until test-mode products,
webhook delivery, subscription synchronization, and portal flows have been
verified end to end. When that work is enabled:

1. Create a [Stripe account](https://stripe.com/)
2. Get your API keys from the dashboard
3. Set up webhook endpoints for subscription management

## Troubleshooting

### Common Issues

1. **"DATABASE_URL environment variable is required"**
   - Make sure `.env.local` exists and contains `DATABASE_URL`
   - Restart your development server after adding environment variables

2. **"Cannot connect to database"**
   - Check that the MongoDB server or hosted cluster is reachable
   - Verify the connection string and cluster network allow-list
   - Ensure the selected database user can read and write the required collections

3. **Prisma client issues**
   - Run `pnpm db:generate` to regenerate the client
   - Run `pnpm db:deploy` to sync the MongoDB schema and required indexes

4. **Authentication errors**
   - Verify `NEXTAUTH_SECRET` is set
   - Check `NEXTAUTH_URL` matches your development URL

5. **Port conflicts**
   - Change the port in `package.json` scripts if 3000 is busy
   - Or kill processes using the port: `lsof -ti:3000 | xargs kill -9`

## Development Commands

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Set up database
pnpm db:generate
pnpm db:deploy

# Run development server
pnpm dev

# Database management
pnpm db:studio    # Open Prisma Studio (database browser)
pnpm db:generate  # Regenerate Prisma client
pnpm db:deploy    # Schema synchronization plus required index bootstrap

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint

# Check the production surface for placeholder destinations and dead controls
pnpm quality:imports
pnpm quality:secrets
pnpm quality:surface
pnpm quality:telemetry

# Verify a hosted deployment's health, public pages, 404 surface, provenance,
# and customer-facing enterprise-surface route gate
VERIFY_BASE_URL=https://your-domain.example \
VERIFY_BRAND_LAB_DISABLED=true \
pnpm verify:deployment

# Run the Chromium production smoke suite (the local harness synchronizes its
# MongoDB schema/indexes before starting the built server). Point
# E2E_DATABASE_URL at an isolated database; existing test data is not reset.
# The suite starts the current build unless E2E_REUSE_SERVER=true is explicit.
# Playwright sets E2E_TEST_MODE only for its local deterministic fixture server;
# never carry that flag into preview or production.
pnpm exec playwright install chromium
pnpm test:e2e
```

## File Structure

```
pitchgenie/
├── app/                    # Next.js app directory
├── components/            # Reusable UI components
├── lib/                   # Utility functions and configurations
├── prisma/               # Database schema
│   └── schema.prisma     # Database schema definition
├── auth.ts               # NextAuth configuration
├── .env.local            # Environment variables (create this)
└── package.json          # Dependencies and scripts
```

## Next Steps

After setting up the environment variables:

1. Set up the database: `pnpm db:deploy`
2. Review expired-record cleanup and 180-day telemetry retention: `pnpm db:prune:expired`
3. Start the development server: `pnpm dev`
4. Open [http://localhost:3000](http://localhost:3000)
5. Sign up or sign in to test authentication
6. Try generating a pitch deck or proposal

## Support

If you encounter issues:
1. Check the console for error messages
2. Verify all environment variables are set correctly
3. Ensure the database is set up correctly
4. Check the browser's Network tab for API errors
5. Use `pnpm db:studio` to inspect your database
