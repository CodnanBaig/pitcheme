# Contributing to PitchGenie

## Local workflow

1. Use Node.js 20 or newer and pnpm 10.12.1.
2. Copy `.env.example` to `.env.local` and configure MongoDB and OpenRouter.
3. Install with `pnpm install --frozen-lockfile`.
4. Generate and synchronize Prisma with `pnpm db:generate` and `pnpm db:deploy`.
5. Before opening a change, run `pnpm lint`, `pnpm quality:imports`,
   `pnpm quality:secrets`, `pnpm quality:surface`, `pnpm quality:telemetry`,
   `pnpm typecheck`, `pnpm exec jest --runInBand`, and `pnpm build`.

The CI workflow runs the same gates with placeholder credentials and does not
call external AI, SMTP, Stripe, or database services.

## Scope and review

- Keep changes focused on one product or operational concern.
- Preserve the enterprise visual system: restrained hierarchy, clear states,
  and useful output over decorative dashboard patterns.
- Add or update tests for API behavior, authorization, persistence, and export
  boundaries when those areas change.
- Do not commit `.env*` files, credentials, generated build output, or local
  database artifacts.
