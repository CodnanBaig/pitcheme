# PitchMe Setup Guide

## Environment Variables Setup

Create a `.env.local` file in the root directory with the following variables:

### Required Variables

```bash
# Database Configuration
DATABASE_URL="file:./dev.db"

# NextAuth Configuration
NEXTAUTH_SECRET=your-secret-key-here-change-in-production
NEXTAUTH_URL=http://localhost:3000

# Email Authentication Configuration (Required for user sign-in)
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-gmail@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password-or-password
EMAIL_FROM=noreply@pitchme.com
```

### Optional Variables (for additional features)

```bash
# Stripe Configuration (for billing features)
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
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
   npx prisma generate

   # Create and migrate the database
   npx prisma db push
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

This project uses SQLite for development (easy setup) and can be easily switched to PostgreSQL or MySQL for production.

### SQLite (Development - Default)
SQLite is automatically set up and requires no additional configuration. The database file will be created at `./dev.db` in your project root.

### PostgreSQL (Production)
1. Install PostgreSQL locally or use a cloud provider (AWS RDS, Google Cloud SQL, etc.)
2. Update `DATABASE_URL` in `.env.local`:
   ```bash
   DATABASE_URL="postgresql://username:password@localhost:5432/pitchme"
   ```

### MySQL (Production)
1. Install MySQL locally or use a cloud provider
2. Update `DATABASE_URL` in `.env.local`:
   ```bash
   DATABASE_URL="mysql://username:password@localhost:3306/pitchme"
   ```

### Database Management
```bash
# View your database in a browser
pnpm db:studio

# Reset and recreate the database
npx prisma db push --force-reset

# Create a migration (for schema changes)
npx prisma migrate dev --name your-migration-name
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

The application uses email magic links for authentication. Configure your email provider:

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
1. Start the development server
2. Go to `/auth/signup` or `/auth/signin`
3. Enter your email address
4. Check your email for the magic link
5. Click the link to complete authentication

## Stripe Setup (Optional)

1. Create a [Stripe account](https://stripe.com/)
2. Get your API keys from the dashboard
3. Set up webhook endpoints for subscription management

## Troubleshooting

### Common Issues

1. **"DATABASE_URL environment variable is required"**
   - Make sure `.env.local` exists and contains `DATABASE_URL`
   - Restart your development server after adding environment variables

2. **"Cannot connect to database"**
   - For SQLite: Check if the database file exists at `./dev.db`
   - For PostgreSQL/MySQL: Check if the database server is running
   - Verify the connection string format
   - Ensure network access (for cloud databases)

3. **Prisma client issues**
   - Run `npx prisma generate` to regenerate the client
   - Run `npx prisma db push` to sync the database schema

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
npx prisma generate
npx prisma db push

# Run development server
pnpm dev

# Database management
pnpm db:studio    # Open Prisma Studio (database browser)
pnpm db:generate  # Regenerate Prisma client
pnpm db:push      # Push schema changes to database
pnpm db:migrate   # Create and run migrations

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint
```

## File Structure

```
pitchme/
├── app/                    # Next.js app directory
├── components/            # Reusable UI components
├── lib/                   # Utility functions and configurations
├── prisma/               # Database schema and migrations
│   ├── schema.prisma     # Database schema definition
│   └── migrations/       # Database migrations
├── auth.ts               # NextAuth configuration
├── .env.local            # Environment variables (create this)
└── package.json          # Dependencies and scripts
```

## Next Steps

After setting up the environment variables:

1. Set up the database: `npx prisma db push`
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
