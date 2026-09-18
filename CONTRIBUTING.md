# Contributing to PitchGenie

## Local workflow

1. Copy `.env.example` to `.env.local` and configure MongoDB and OpenRouter.
2. Install with `pnpm install`.
3. Generate and synchronize Prisma with `pnpm db:generate` and `pnpm db:push`.
4. Before opening a change, run `pnpm lint`, `pnpm typecheck`,
   `pnpm exec jest --runInBand`, and `pnpm build`.

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
