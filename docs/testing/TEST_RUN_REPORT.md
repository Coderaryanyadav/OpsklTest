# Test run report

**Date:** 2026-10-22 (IST)
**Repository:** `/Users/aryan/Desktop/PROJECTS/OPSKIL`
**Branch:** `main`
**Scope:** local disposable Supabase + Dockerized Admin/Worker/Organizer web
targets + real Chromium + real Auth/PostgREST/RLS.
**Overall scoped result:** **PASS**
**Overall platform readiness:** **PARTIAL** (native, provider, and production
behavior remain blocked/unverified)
**Executed-suite failures:** **0**

## 1. What was actually executed

| Check | Command | Result | Exit | Evidence |
| --- | --- | --- | --- | --- |
| TypeScript | `npm run typecheck` | PASS | 0 | `test-artifacts/docker/typecheck.log` |
| Lint | `npm run lint` | PASS | 0 | `test-artifacts/docker/lint.log` |
| Unit/static suites | `npm test` | PASS, 32 suites / 390 tests | 0 | `test-artifacts/docker/npm-test.log` |
| Brutal static contracts | `npm run test:brutal` | PASS, 17/17 | 0 | `test-artifacts/docker/brutal-17.log` |
| Admin production build | `CI=1 npm run build:admin` | PASS | 0 | `test-artifacts/docker/admin-build.log` |
| Compose syntax | `docker compose ... config -q` | PASS | 0 | command log |
| Fresh DB reset | `./docker/scripts/reset-test-data.sh` | PASS, 44 migrations | 0 | `test-artifacts/docker/db-reset.log` |
| DB lifecycle/RLS | `DATABASE_URL=... node scripts/test_lifecycle_db.mjs` | PASS, 69/69 | 0 | `test-artifacts/docker/lifecycle-db.log` |
| Full three-role DB workflow | `DATABASE_URL=... node scripts/test_full_workflow_db.mjs` | PASS, 52/52 | 0 | `test-artifacts/docker/full-workflow-db.log` |
| SQL integration/hardening | `DATABASE_URL=... node scripts/test_sql_integration.mjs` | PASS, 56 checks | 0 | `test-artifacts/docker/sql-integration.log` |
| Phase 4 marketplace | `DATABASE_URL=... node scripts/test_phase4_marketplace.mjs` | PASS, 12/12 steps | 0 | `test-artifacts/docker/phase4-marketplace.log` |
| Docker smoke/readiness | `./docker/scripts/run-smoke-tests.sh` | PASS | 0 | `test-artifacts/docker/smoke.log` |
| Docker API/RLS | `./docker/scripts/run-e2e-tests.sh` | PASS, 41/41 | 0 | `test-artifacts/docker/api-rpc-rls.log` |
| Docker Chromium UI | `./docker/scripts/run-e2e-tests.sh` | PASS, 18/18 | 0 | `test-artifacts/docker/browser-ui.log`, `ui-checks.json` |
| Runner orchestration | same command | PASS, `failed: 0` | 0 | `test-artifacts/docker/test-summary.json` |
| Service-role isolation | smoke script assertion | PASS, key ABSENT from app containers | 0 | `test-artifacts/docker/smoke.log` |

The container run summary:

```json
{
  "startedAt": "2026-10-22T08:38:15.036Z",
  "finishedAt": "2026-10-22T08:38:20.883Z",
  "node": "v24.21.0",
  "platform": "linux/arm64",
  "results": [
    { "label": "seed", "exitCode": 0 },
    { "label": "api-rpc-rls", "exitCode": 0 },
    { "label": "browser-ui", "exitCode": 0 }
  ],
  "failed": 0
}
```

`test-summary.json` is the authoritative machine-readable summary. Log paths in
it are container paths (`/reports/...`), mounted from
`test-artifacts/docker/`.

## 2. Environment

| Item | Value |
| --- | --- |
| Host | macOS arm64 |
| Docker | 29.4.0 |
| Compose | v5.1.2 |
| Supabase CLI | 2.121.0 |
| Host Node | v26.11.1 |
| Runner Node | v24.21.0 |
| Playwright | 1.64.0, Chromium headless |
| PostgreSQL | 17.11 |
| Migrations | 44 applied, no duplicates |
| Compose project | `opskl-test` |
| Test network | `opskl-test-net` |
| App URLs | `127.0.0.1:3001`, `:3002`, `:3003` |
| Supabase | `127.0.0.1:54321`, DB `:54322` |

## 3. Workflow results

### 3.1 API/Auth/PostgREST/RLS — PASS 41/41

Executed with real GoTrue password sessions:

- unauthenticated KYC read denied;
- worker cannot call admin approval;
- organizer cannot call admin settlement;
- worker cannot read organizer invoices;
- verified organizer publishes;
- worker cannot publish for organizer;
- server-derived pay;
- discovery feed;
- apply, duplicate apply rejection;
- shortlist;
- offer, duplicate offer rejection;
- worker acceptance, duplicate acceptance handling;
- job fill and no overbooking;
- invalid code and geofence rejection;
- check-in, idempotent duplicate check-in;
- check-out;
- attendance/pay approval;
- invoice;
- test-ledger funding;
- payout and idempotency;
- settlement and different-UTR rejection;
- `is_current_admin` role assertions.

The service-role client was used only for synthetic setup, state verification,
and disposable attendance time-travel. It did not bypass the tested RPC state
machine.

### 3.2 Browser UI — PASS 18/18

Admin (Next.js):

- unauthenticated redirect to `/login`;
- worker credentials denied;
- admin login reaches dashboard;
- dashboard queues render;
- verification queue reachable and seeded KYC visible;
- disputes center reachable;
- audit log reachable;
- no uncaught page errors.

Worker (Expo web):

- password login leaves login route;
- feed renders;
- untouched seeded shift appears;
- no uncaught page errors.

Organizer (Expo web):

- password login leaves login route;
- verified business name renders;
- seeded shift renders;
- roster route renders;
- no uncaught page errors.

Screenshots:

- `test-artifacts/docker/admin-dashboard.png`
- `test-artifacts/docker/admin-verifications.png`
- `test-artifacts/docker/worker-feed.png`
- `test-artifacts/docker/organizer-dashboard.png`
- `test-artifacts/docker/organizer-roster.png`

### 3.3 Fresh database — PASS

`./docker/scripts/reset-test-data.sh`:

- removed only compose project `opskl-test`;
- reset the local Supabase DB;
- applied all 44 migrations in order;
- recreated network aliases;
- exited 0.

No migration version collision remained. `supabase/seed.sql` was absent; the
CLI printed `no files matched pattern: supabase/seed.sql`, which is expected and
not a failure.

### 3.4 DB suites — PASS

| Suite | Count | Exit |
| --- | --- | --- |
| Lifecycle/RLS/trigger/grants | 69/69 | 0 |
| Full worker/organizer/admin workflow | 52/52 | 0 |
| SQL integration/hardening | 56 checks | 0 |
| Phase 4 marketplace | 12/12 steps | 0 |

## 4. Status classification

| Area | Status | Basis |
| --- | --- | --- |
| Migrations on fresh disposable DB | **PASS** | 44/44 applied, exit 0 |
| Database lifecycle/RLS/authorization | **PASS** | 69/69 + 56 checks |
| Three-role API workflow | **PASS** | 41/41 real Auth/PostgREST/RLS |
| Admin web experience | **PASS** | Next.js build + Chromium checks |
| Worker web experience | **PASS** | Expo web export + Chromium checks |
| Organizer web experience | **PASS** | Expo web export + Chromium checks |
| Persistent Docker test environment | **PASS** | compose build/up/smoke/e2e, exit 0 |
| Native iOS/Android | **BLOCKED** | no simulator/device or native build run |
| Device GPS/camera/push/permissions/offline | **BLOCKED** | web target cannot verify |
| Real email/SMS/OTP/APNs/FCM | **BLOCKED** | no provider credentials/callbacks |
| Real payment/escrow/provider settlement | **BLOCKED** | test ledger only |
| Production/staging schema/RLS/pooler/HA/load | **BLOCKED** | not executed against production |
| Supabase Realtime delivery / Edge Function | **BLOCKED** | not exercised |
| Safari/Firefox | **BLOCKED** | Chromium only |
| Manual visual/accessibility review | **BLOCKED** | no manual review performed |
| Existing remote Admin Playwright spec | **NOT RUN** | would target remote `.env.local`; unsafe |

No executed suite failed. The blocked items are scope limits, not hidden
failures.

## 5. Failure history and resolution

The first container UI attempt was **14/18 FAIL** because the test-runner image
was stale and the seed had only one shift (already applied by the worker). It
was not a product failure. After rebuilding the runner, adding an untouched
discovery shift, and waiting for the organizer profile fetch, the run passed
18/18.

An intermediate API run showed three false failures:

- wrong RPC argument name (`p_status` vs `p_new_status`);
- wrong pre-acceptance booking status expectation;
- duplicate check-in treated as a failure instead of the backend's documented
  idempotent response.

The assertions were corrected; the API then passed 41/41. Details are in
`docs/testing/BUGS_FOUND_AND_FIXED.md`.

## 6. Evidence and reproduction

Reproduce from the repository root:

```bash
./docker/scripts/reset-test-data.sh
./docker/scripts/run-smoke-tests.sh
./docker/scripts/run-e2e-tests.sh
```

Local evidence (gitignored):

```text
test-artifacts/docker/
  test-summary.json
  ui-checks.json
  seed.log
  api-rpc-rls.log
  browser-ui.log
  e2e-console.log
  smoke.log
  db-reset.log
  lifecycle-db.log
  full-workflow-db.log
  sql-integration.log
  phase4-marketplace.log
  admin-dashboard.png
  admin-verifications.png
  worker-feed.png
  organizer-dashboard.png
  organizer-roster.png
```

The exact container test matrix is in
`docs/testing/E2E_WORKFLOW_TEST_MATRIX.md`. Environment design is in
`docs/testing/DOCKER_TEST_ENVIRONMENT.md`. Remaining blockers are in
`docs/testing/REMAINING_BLOCKERS.md`.

## 7. Final statement

Within the scoped environment, the Admin, Worker, and Organizer **web**
experiences and the Auth/PostgREST/RLS backend workflows are verified by real
executed tests with zero failures.

This is **not** a claim that the native mobile apps, external providers, or
production deployment are verified. Those remain **BLOCKED** and must be tested
with the appropriate devices, provider sandboxes, and staging infrastructure.
