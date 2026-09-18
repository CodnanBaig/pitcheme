# PitchGenie Setup Guide

## Environment Variables Setup

Copy `.env.example` to `.env.local` and replace the placeholders. The Prisma
schema uses MongoDB in local, preview, and production environments.

### Required Variables

```bash
# Database Configuration
DATABASE_URL="mongodb://127.0.0.1:27017/pitchgenie"

# NextAuth Configuration
NEXTAUTH_SECRET=replace-with-a-long-random-secret
NEXTAUTH_URL=http://localhost:3000

# AI generation (required for generation routes)
OPENROUTER_API_KEY=your-openrouter-key

# Optional blended paid-model rate in USD per million tokens
AI_COST_PER_MILLION_TOKENS=

# Optional release identifier shown by readiness checks
APP_VERSION=0.1.0

# Optional live provider probes (keep false for local/CI)
HEALTHCHECK_EXTERNAL_SERVICES=false

# Optional export-runtime probe; set true in production to require Chromium
HEALTHCHECK_EXPORT_RUNTIME=false

# Shared rate-limit store: mongodb enables distributed rate limits and atomic
# monthly usage reservations. Use process only for local-only development.
RATE_LIMIT_STORE=process

# Optional deployment-provided Chromium path for PDF exports
CHROMIUM_EXECUTABLE_PATH=

# Email magic links (optional; credentials auth works without SMTP)
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-gmail@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password-or-password
EMAIL_FROM=noreply@example.com
```

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

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up the database:**
   ```bash
# Generate the Prisma client
   pnpm db:generate

   # Synchronize the MongoDB schema
   pnpm db:push
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

## Database Setup

This project uses MongoDB through Prisma. A local MongoDB server is convenient
for development; a hosted MongoDB cluster is recommended for preview and
production. `prisma db push` synchronizes the schema because Prisma migrations
are not used for this MongoDB datasource.

### Database Management
```bash
# View your database in a browser
pnpm db:studio

# Synchronize the MongoDB schema
pnpm db:deploy
```

## Google OAuth Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)

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
   - Run `pnpm db:push` to sync the MongoDB schema

4. **Authentication errors**
   - Verify `NEXTAUTH_SECRET` is set
   - Check `NEXTAUTH_URL` matches your development URL

5. **Port conflicts**
   - Change the port in `package.json` scripts if 3000 is busy
   - Or kill processes using the port: `lsof -ti:3000 | xargs kill -9`

## Development Commands

```bash
# Install dependencies
pnpm install

# Set up database
pnpm db:generate
pnpm db:push

# Run development server
pnpm dev

# Database management
pnpm db:studio    # Open Prisma Studio (database browser)
pnpm db:generate  # Regenerate Prisma client
pnpm db:push      # Push schema changes to database
pnpm db:deploy    # Alias for MongoDB schema synchronization

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint

# Run the Chromium production smoke suite (the local harness synchronizes its
# MongoDB schema/indexes before starting the built server). Point
# E2E_DATABASE_URL at an isolated database; existing test data is not reset.
# The suite starts the current build unless E2E_REUSE_SERVER=true is explicit.
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

1. Set up the database: `pnpm db:push`
2. Start the development server: `pnpm dev`
3. Open [http://localhost:3000](http://localhost:3000)
4. Sign up or sign in to test authentication
5. Try generating a pitch deck or proposal

## Support

If you encounter issues:
1. Check the console for error messages
2. Verify all environment variables are set correctly
3. Ensure the database is set up correctly
4. Check the browser's Network tab for API errors
5. Use `pnpm db:studio` to inspect your database
