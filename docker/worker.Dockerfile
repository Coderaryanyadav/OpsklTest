# OPSKL Worker - Expo web static export served by unprivileged nginx.
# This is the web target, not a native iOS/Android build.
# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV CI=1 \
    EXPO_NO_TELEMETRY=1

COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/organizer/package.json apps/organizer/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN npm ci --no-audit --no-fund

COPY tsconfig.base.json ./
COPY apps/worker ./apps/worker
COPY packages ./packages

ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ARG EXPO_PUBLIC_APP_ENV=test
ARG EXPO_PUBLIC_DEFAULT_CITY=Mumbai
ARG EXPO_PUBLIC_DEFAULT_TIMEZONE=Asia/Kolkata
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL \
    EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY \
    EXPO_PUBLIC_APP_ENV=$EXPO_PUBLIC_APP_ENV \
    EXPO_PUBLIC_DEFAULT_CITY=$EXPO_PUBLIC_DEFAULT_CITY \
    EXPO_PUBLIC_DEFAULT_TIMEZONE=$EXPO_PUBLIC_DEFAULT_TIMEZONE
RUN cd apps/worker && npx expo export --platform web --output-dir dist-web

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY docker/nginx/expo.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/worker/dist-web /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=6 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
