# OPSKL Admin (Next.js) - production-style local test image.
# Build context must be the repository root:
#   docker build -f docker/admin.Dockerfile -t opskl-admin:test .
# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/organizer/package.json apps/organizer/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN npm ci --no-audit --no-fund

COPY tsconfig.base.json ./
COPY apps/admin ./apps/admin
COPY packages ./packages

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL=http://127.0.0.1:3001
ARG NEXT_PUBLIC_APP_ENV=test
ARG NEXT_PUBLIC_DEFAULT_CITY=Mumbai
ARG NEXT_PUBLIC_TIMEZONE=Asia/Kolkata
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV \
    NEXT_PUBLIC_DEFAULT_CITY=$NEXT_PUBLIC_DEFAULT_CITY \
    NEXT_PUBLIC_TIMEZONE=$NEXT_PUBLIC_TIMEZONE
RUN npm run build:admin

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/apps/admin ./apps/admin
COPY --chown=node:node scripts/docker/browser_proxy.mjs ./scripts/docker/browser_proxy.mjs

USER node
ENV BROWSER_PROXY_TARGET=http://opskl-test-api:8000 \
    BROWSER_PROXY_PORT=54321
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node scripts/docker/browser_proxy.mjs & exec npm --workspace=@opskil/admin run start -- -p 3000 -H 0.0.0.0"]
