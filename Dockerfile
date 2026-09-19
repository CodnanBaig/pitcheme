# Production image for a Node host with the Chromium runtime required by PDF export.
FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    ca-certificates \
    openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack install \
  && pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .

# Builds must be deterministic and must not depend on a live provider or database.
ENV NODE_ENV="production"
ENV DATABASE_URL="mongodb://127.0.0.1:27017/pitchgenie-build?replicaSet=rs0"
ENV NEXTAUTH_URL="https://build.example.com"
ENV NEXTAUTH_SECRET="build-only-secret-that-is-at-least-32-characters-long"
ENV OPENROUTER_API_KEY="build-only-placeholder-key"
ENV STRIPE_BILLING_ENABLED="false"
ENV BRAND_LAB_ENABLED="false"
ENV HEALTHCHECK_EXTERNAL_SERVICES="false"
ENV HEALTHCHECK_EXPORT_RUNTIME="true"
ENV HEALTHCHECK_DATABASE_INDEXES="true"
ENV RATE_LIMIT_STORE="mongodb"

RUN pnpm build

FROM dependencies AS production-dependencies

# Keep development-only tooling out of the runtime image. The Prisma CLI is a
# production dependency here because the runtime image regenerates the client
# for the container's platform before dropping privileges.
RUN pnpm prune --prod

FROM node:20-bookworm-slim AS runtime

ARG APP_VERSION=unknown
ARG BUILD_SHA=unknown

ENV NODE_ENV="production"
ENV PORT="3000"
ENV HOSTNAME="0.0.0.0"
ENV APP_VERSION="$APP_VERSION"
ENV BUILD_SHA="$BUILD_SHA"
ENV CHROMIUM_EXECUTABLE_PATH="/usr/bin/chromium"
ENV HEALTHCHECK_EXPORT_RUNTIME="true"
ENV HEALTHCHECK_DATABASE_INDEXES="true"
ENV RATE_LIMIT_STORE="mongodb"
ENV STRIPE_BILLING_ENABLED="false"
ENV BRAND_LAB_ENABLED="false"

RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    ca-certificates \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=build --chown=node:node /app/config ./config
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/scripts ./scripts

# Generate the Prisma client in the runtime layer so the platform-specific
# query engine is present without requiring a package-manager download at boot.
RUN DATABASE_URL="mongodb://127.0.0.1:27017/pitchgenie-runtime-build?replicaSet=rs0" \
  ./node_modules/.bin/prisma generate

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/ready').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["./node_modules/.bin/next", "start"]
