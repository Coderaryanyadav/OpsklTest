# OPSKL test runner: real browser + API/RLS workflow driver.
# This image is never used for production and receives test-only credentials.
# syntax=docker/dockerfile:1.7

FROM mcr.microsoft.com/playwright:v1.64.0-noble

ENV CI=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    NODE_ENV=test

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/organizer/package.json apps/organizer/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN npm ci --no-audit --no-fund

COPY scripts/docker ./scripts/docker

RUN mkdir -p /reports
VOLUME ["/reports"]
CMD ["node", "scripts/docker/run_all_tests.mjs"]
