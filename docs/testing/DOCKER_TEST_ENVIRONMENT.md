# Docker test environment

**Status: PASS for the scoped local Docker/web/API environment.**
This document describes what was built, how it is isolated, and what it does
and does not prove. It does not claim native mobile, external-provider, or
production verification.

Validated: 2026-10-22 (IST), branch `main`, repository
`/Users/aryan/Desktop/PROJECTS/OPSKIL`.

## 1. Scope

The environment exists to answer four questions with executable evidence:

1. Do all 44 migrations apply cleanly to a fresh disposable database?
2. Do real GoTrue sessions and PostgREST RPCs enforce the intended role and RLS
   boundaries?
3. Can the Admin, Worker, and Organizer web experiences be built, served, and
   used in a browser against that backend?
4. Can the whole sequence be repeated from one command without touching
   production data or credentials?

The Worker and Organizer containers are Expo **web static exports**. They are
not native iOS/Android applications, and no simulator or physical device was
used.

## 2. Version matrix

| Component | Version / detail |
| --- | --- |
| Host OS | macOS arm64 |
| Docker | `29.4.0` |
| Docker Compose | `v5.1.2` |
| Supabase CLI | `2.121.0` via `npx` |
| Host Node | `v26.11.1` |
| Runner Node | `v24.21.0` |
| Playwright | `1.64.0` |
| PostgreSQL | 17.11 in the local Supabase DB container |
| Admin | Next.js 15.5.27 / Node 22 image |
| Worker / Organizer | Expo SDK ~57 / React Native 0.86 web export |
| Migrations | 44, no duplicate versions |
| Browser | Chromium via Playwright, headless |

## 3. Topology

```text
Host loopback only
  127.0.0.1:3001  -> opskl-test-admin-1      (Next.js, healthy)
  127.0.0.1:3002  -> opskl-test-worker-1     (nginx + Expo web export)
  127.0.0.1:3003  -> opskl-test-organizer-1  (nginx + Expo web export)
  127.0.0.1:54321 -> local Supabase Kong     (Auth/REST/Storage)
  127.0.0.1:54322 -> local Supabase Postgres

Docker network opskl-test-net
  opskl-test-admin-1
  opskl-test-worker-1
  opskl-test-organizer-1
  opskl-test-runner (one-shot, no published port)
      -> browser_proxy 127.0.0.1:54321 -> opskl-test-api:8000
      -> scripts: seed -> API/RLS -> Chromium UI
  opskl-test-api  (alias for supabase_kong_OPSKIL)
  opskl-test-db   (alias for supabase_db_OPSKIL)

Host Supabase CLI stack
  supabase_db_OPSKIL
  supabase_kong_OPSKIL
  supabase_auth_OPSKIL
  supabase_rest_OPSKIL
  supabase_storage_OPSKIL
```

The compose project is `opskl-test`; its default network is the external
`opskl-test-net`. The preflight script is the only component that attaches the
Supabase containers to that network.

## 4. Isolation and safety controls

### 4.1 Endpoint and credential guards

`docker/scripts/preflight.sh` enforces:

- `.env.docker.test` must exist.
- `NEXT_PUBLIC_SUPABASE_URL` must be `http://127.0.0.1:54321` or
  `http://localhost:54321`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY` must be non-empty.
- `supabase_db_OPSKIL` must carry the Supabase CLI label
  `com.supabase.cli.project=OPSKIL`.
- Its `com.supabase.cli.workdir` label must equal this repository path.
- The local Auth and REST endpoints must return HTTP success before tests start.

`docker/scripts/reset-test-data.sh` repeats the loopback check before doing any
destructive operation.

### 4.2 Secret handling

- `.env.docker.test` is gitignored with mode `600`; it is not in the repository.
- `.env.docker.test.example` contains placeholders only.
- Build args and app runtime receive only the anon key.
- The service-role key is passed only to `opskl-test-runner` for synthetic user
  creation and row verification.
- The admin compose service no longer uses the full test env file, so the
  service-role key is not injected into an app container.
- `run-smoke-tests.sh` asserts that the service-role key is absent from the
  Admin, Worker, and Organizer containers.
- No key values are written to reports, logs, or screenshots.

### 4.3 Data isolation

- All identities use `@test.opskil.local`.
- Fixtures are synthetic and contain no customer data.
- The DB is the local Supabase CLI database on port `54322`.
- The seed cleanup removes prior synthetic test rows in FK-safe order. It does
  not truncate unrelated platform tables.
- Financial records use explicit test references such as
  `TEST-DOCKER-FUNDING-*`, `TESTUTR-DOCKER-*`, and test idempotency keys.
- `reset-test-data.sh` removes only compose project `opskl-test` resources and
  resets the local Supabase DB.

### 4.4 Network isolation

- App ports bind to `127.0.0.1` in compose.
- The test-runner service publishes no port.
- The proxy listens on `127.0.0.1` inside its container only.
- Only the local Supabase DB and Kong containers are attached to the test
  network.

## 5. Build strategy

### Admin

`docker/admin.Dockerfile`:

- Node 22 bookworm builder;
- `npm ci` from the root lockfile;
- Next.js production build with test public URL baked in;
- runtime image contains the built app, production dependencies, and packages;
- runs as the unprivileged `node` user;
- health check calls `/api/health`;
- starts a loopback proxy on `127.0.0.1:54321` before Next.js. This is a
  fallback for server-side code that uses the build-time public Supabase URL;
  it forwards to `opskl-test-api:8000`.

### Worker and Organizer

`docker/worker.Dockerfile` and `docker/organizer.Dockerfile`:

- Node 22 builder runs `expo export --platform web`;
- static output is copied into `nginxinc/nginx-unprivileged`;
- `/healthz` returns `ok`;
- clean routes use `try_files $uri $uri.html $uri/ /index.html`;
- `/etc/nginx` is not modified at runtime.

The exports were verified to contain the local Supabase URL, not a remote
project.

### Test runner

`docker/test-runner.Dockerfile` uses
`mcr.microsoft.com/playwright:v1.64.0-noble`, installs repository dependencies
from the lockfile, copies only the test scripts, and runs:

```text
node scripts/docker/run_all_tests.mjs
```

It is a one-shot service. It has no published port and writes evidence to a bind
mount at `/reports`.

## 6. Fixture design

`scripts/docker/seed_test_data.mjs`:

1. Lists prior users on the reserved test domain.
2. Deletes dependent payment, dispute, attendance, invoice, booking, and job
   rows in FK-safe order, then profiles, then Auth users.
3. Creates three Auth users with `email_confirm: true`.
4. Promotes the admin with the service-role client, never via client metadata.
5. Signs all three users in with real passwords.
6. Completes synthetic worker and organizer profiles.
7. Submits synthetic KYC cases and approves them through
   `admin_verify_case_safe`.
8. Publishes two shifts through `create_job_safe`:
   - `Docker Test Hospitality Shift` with a worker application, for the
     organizer screens;
   - `Docker Test Open Discovery Shift` without an application, for the worker
     discovery feed.
9. Prints only account emails, IDs, and fixture IDs. No passwords or keys.

The two-shift design is intentional: the discovery feed excludes shifts the
current worker has already applied to, so a single applied shift cannot prove
both organizer and worker UI paths.

## 7. Browser architecture

The UI suite uses one Chromium instance and separate browser contexts for each
role. It drives:

- unauthenticated Admin redirect;
- worker credentials rejected by Admin;
- Admin password login, verification queue, disputes, and audit screens;
- Worker password login and discovery feed;
- Organizer password login, dashboard, and roster route.

Because the Expo bundles use `http://127.0.0.1:54321`, the test runner starts
`scripts/docker/browser_proxy.mjs`:

```text
127.0.0.1:54321 (runner) -> opskl-test-api:8000
```

This is a test-browser bridge. It is not exposed to the host or another
network.

## 8. Health and readiness

Nothing is declared ready from a fixed sleep alone.

- `wait-for-health.sh` polls an HTTP URL until success or timeout.
- `run_all_tests.mjs` polls Admin `/api/health`, Worker `/healthz`, Organizer
  `/healthz`, Supabase Auth health, and Supabase REST.
- The test runner waits for the browser proxy before starting the UI suite.
- Compose health checks use built-in Node `fetch` or nginx `wget`.
- The smoke script checks HTTP readiness and app container health.

The immediate `docker compose ps` snapshot in the smoke script can show
`health: starting` because it is taken milliseconds after startup. The script
only reports PASS after every HTTP probe succeeds, and the containers were
healthy on later inspection.

## 9. Reproducibility and evidence

Final fresh-database sequence:

```bash
./docker/scripts/reset-test-data.sh          # exit 0, 44 migrations
node scripts/test_lifecycle_db.mjs           # 69/69, exit 0
node scripts/test_full_workflow_db.mjs       # 52/52, exit 0
node scripts/test_sql_integration.mjs        # 56 checks, exit 0
node scripts/test_phase4_marketplace.mjs     # 12/12 steps, exit 0
./docker/scripts/run-e2e-tests.sh            # exit 0
```

Container results:

- API/RLS: **41 passed, 0 failed**
- Chromium UI: **18 passed, 0 failed**
- Runner summary: `failed: 0`

Evidence lives in `test-artifacts/docker/` (gitignored):

```text
test-summary.json
ui-checks.json
seed.log
api-rpc-rls.log
browser-ui.log
admin-dashboard.png
admin-verifications.png
worker-feed.png
organizer-dashboard.png
organizer-roster.png
```

Full run report: `docs/testing/TEST_RUN_REPORT.md`.

## 10. Boundaries

This environment does not prove:

- native iOS/Android behavior, signing, store builds, or device permissions;
- GPS, camera, push, background execution, or offline replay;
- real email, SMS, OTP, APNs, or FCM delivery;
- real payment authorization, escrow, settlement, or webhook handling;
- production/staging schema drift, pooler JWT behavior, HA, or performance;
- Supabase Realtime delivery, Edge Function behavior, or webhook retries;
- Safari or Firefox behavior;
- accessibility beyond automated page-error checks.

Those items are listed as blocked or unverified in
`docs/testing/REMAINING_BLOCKERS.md`; they are not reported as passing.
