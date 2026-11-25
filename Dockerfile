# Production image of this app. With the generated docker-compose.yml:
#
#   docker compose --profile app up -d --build
#
# or on its own (secrets come from the environment, never the image):
#
#   docker build -t my-app .
#   docker run -p 3355:3355 --env-file .env my-app
#
# Installs with whichever lockfile the project has (Bun, npm, pnpm or Yarn).
# Run the database migrations before starting it; the image doesn't.

FROM node:22-bookworm-slim AS base
# Prisma needs OpenSSL to pick its query engine; harmless for Drizzle/Kysely.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=oven/bun:1.3 /usr/local/bin/bun /usr/local/bin/bun
RUN corepack enable
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
COPY . .
RUN if [ -f bun.lock ]; then bun install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    elif [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
    elif [ -f yarn.lock ]; then yarn install --immutable; \
    else bun install; fi
# Build-time placeholders only: real values come from the environment at run time.
RUN NEXT_OUTPUT=standalone BETTER_AUTH_URL=http://localhost:3355 BETTER_AUTH_SECRET=build-only-placeholder-secret-not-used-at-runtime \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    node node_modules/next/dist/bin/next build

# Only the standalone server and its traced dependencies, no dev tooling.
FROM node:22-bookworm-slim AS run
# Prisma needs OpenSSL to pick its query engine; harmless for Drizzle/Kysely.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3355 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3355
CMD ["node", "server.js"]
