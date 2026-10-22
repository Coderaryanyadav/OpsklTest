# OPSKL isolated Docker test environment

This directory contains the disposable Docker stack used to exercise the Admin,
Worker, and Organizer app experiences against a real local Supabase backend.

The stack is **test-only**. It does not point at production, does not use real
customer data, and does not call real payment, SMS, email, push, or app-store
providers.

## What is tested

| Target | Container | What it actually is |
| --- | --- | --- |
| Admin | `opskl-admin:test` | Next.js 15 production build on Node 22 |
| Worker | `opskl-worker:test` | Expo web static export served by nginx |
| Organizer | `opskl-organizer:test` | Expo web static export served by nginx |
| Backend | Local Supabase CLI stack | PostgreSQL, GoTrue Auth, PostgREST, Storage, Kong |
| Test runner | `opskl-test-runner:test` | Playwright Chromium + Node workflow drivers |

The Worker and Organizer images are **web targets**. They are not iOS or Android
builds, and a passing run here is not evidence that native camera, GPS,
permissions, push notifications, or device offline behavior work.

## Prerequisites

- Docker Engine / OrbStack with Compose v2 or later
- Node.js and npm
- Supabase CLI available through `npx` (validated with `2.121.0`)
- The repository checked out at the path stored in the local Supabase labels
- No production Supabase URL or credential in the shell environment

Validated host: macOS arm64, Docker `29.4.0`, Compose `v5.1.2`,
Supabase CLI `2.121.0`, and Node `26.11.1` on the host. The test runner uses
Node `24.21.0` inside the Playwright image.

## Quick start

```bash
cp .env.docker.test.example .env.docker.test
chmod 600 .env.docker.test

npx supabase start
# Fill the placeholders in .env.docker.test from local Supabase status output.
# Do not paste production values. Do not commit the filled file.

./docker/scripts/preflight.sh
./docker/scripts/run-smoke-tests.sh
./docker/scripts/run-e2e-tests.sh
```

`run-e2e-tests.sh` is the one-command test entry point. It builds the app
images, starts them, waits for real HTTP readiness, then runs these stages in
`opskl-test-runner`:

1. idempotent synthetic fixture seed;
2. real Auth + PostgREST + RLS API workflow;
3. real Chromium UI workflow across Admin, Worker, and Organizer.

The final exit code is non-zero if any stage fails.

## URLs

| Service | URL |
| --- | --- |
| Admin | `http://127.0.0.1:3001` |
| Worker web target | `http://127.0.0.1:3002` |
| Organizer web target | `http://127.0.0.1:3003` |
| Supabase API / Auth | `http://127.0.0.1:54321` |
| Supabase PostgreSQL | `127.0.0.1:54322` |

App ports are bound to loopback only in the compose file.

## Layout

```text
docker/
  admin.Dockerfile
  worker.Dockerfile
  organizer.Dockerfile
  test-runner.Dockerfile
  nginx/expo.conf
  compose/docker-compose.test.yml
  scripts/preflight.sh
  scripts/wait-for-health.sh
  scripts/run-smoke-tests.sh
  scripts/run-e2e-tests.sh
  scripts/reset-test-data.sh

scripts/docker/
  seed_test_data.mjs
  test_api_workflow.mjs
  test_ui_workflow.mjs
  run_all_tests.mjs
  browser_proxy.mjs
```

## How the network is isolated

The compose project is named `opskl-test`. Its app containers join the external
network `opskl-test-net`. The preflight script attaches only the local Supabase
DB and Kong containers to that network, with stable aliases:

- `supabase_db_OPSKIL` -> `opskl-test-db`
- `supabase_kong_OPSKIL` -> `opskl-test-api`

`preflight.sh` refuses to run unless:

- `.env.docker.test` exists;
- the public Supabase URL is loopback on port `54321`;
- the DB container has the Supabase CLI project label `OPSKIL`;
- the DB container workdir matches this repository.

It does not print keys. It only prints safe status labels.

## Environment file

`.env.docker.test` is gitignored and mode `600` in the validated run. The
repository contains only `.env.docker.test.example`, with placeholders.

The test runner receives the service-role key because it creates synthetic Auth
users and verifies persisted rows. The Admin, Worker, and Organizer containers
do **not** receive that key. `run-smoke-tests.sh` asserts its absence in all
three app containers.

## Browser access to Supabase

The Expo web bundles are built with `http://127.0.0.1:54321`, which lets the
same export work in a host browser. Inside `opskl-test-runner`, localhost is the
runner container, so the runner starts `browser_proxy.mjs` on
`127.0.0.1:54321` and forwards to `opskl-test-api:8000`.

The Admin image also starts the loopback proxy. This is a fallback for any
server-side code that uses the build-time public URL; it also forwards to
`opskl-test-api:8000`. The proxy never listens on an external interface.

## Synthetic fixtures

`seed_test_data.mjs` creates:

- `admin@test.opskil.local`
- `worker@test.opskil.local`
- `organizer@test.opskil.local`

All identities use the reserved test domain. The script:

- promotes the admin through the service-role client (never client metadata);
- submits and approves synthetic KYC cases through real RPCs;
- creates one shift with a pending application for organizer screens;
- creates one untouched shift for the worker discovery feed;
- cleans up its own prior rows in FK-safe order before recreating them.

The seed is idempotent and was run repeatedly against the same disposable DB.

## Safe reset

```bash
./docker/scripts/reset-test-data.sh
```

This is destructive **only to the local test environment**:

- removes compose project `opskl-test` and its volumes;
- runs `npx supabase db reset` against the local project;
- reapplies all migrations;
- recreates the test network aliases.

It refuses to run if `NEXT_PUBLIC_SUPABASE_URL` is not the local endpoint.

## Useful commands

```bash
# Validate compose syntax without printing secrets
docker compose -p opskl-test --env-file .env.docker.test \
  -f docker/compose/docker-compose.test.yml config -q

# Show status
docker compose -p opskl-test --env-file .env.docker.test \
  -f docker/compose/docker-compose.test.yml ps

# App logs
docker compose -p opskl-test --env-file .env.docker.test \
  -f docker/compose/docker-compose.test.yml logs admin worker organizer

# Stop app containers, keep Supabase running
docker compose -p opskl-test --env-file .env.docker.test \
  -f docker/compose/docker-compose.test.yml down

# Remove test network
docker network rm opskl-test-net
```

## Evidence

The test runner writes to `test-artifacts/docker/`, which is gitignored:

- `test-summary.json`
- `ui-checks.json`
- `seed.log`
- `api-rpc-rls.log`
- `browser-ui.log`
- `admin-dashboard.png`
- `admin-verifications.png`
- `worker-feed.png`
- `organizer-dashboard.png`
- `organizer-roster.png`

See `docs/testing/TEST_RUN_REPORT.md` for the validated run.

## Limitations

- Native iOS/Android builds, simulators, and devices are not run.
- Expo web does not verify native GPS, camera, permissions, push, or offline
  replay.
- No real SMTP, SMS, OTP, APNs, FCM, Razorpay, escrow, or payout provider is
  called. Financial actions are explicit test-ledger entries.
- The test runner uses Chromium only; Safari and Firefox are not covered.
- The test runner image runs Chromium with `--no-sandbox` because it is a
  disposable CI container, not a production browser.
- Local Supabase is not a production HA/pooler environment.
- The existing `apps/admin/e2e/admin_dashboard.spec.ts` must not be run against
  the remote `.env.local` target. It is outside this Docker suite.
