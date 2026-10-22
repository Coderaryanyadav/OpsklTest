# Defects found and fixed during Docker/test-environment work

**Run:** 2026-10-22
**New product defects found in this Dockerization pass:** 0
**New product defects fixed in this pass:** 0
**Test-environment / harness defects found and fixed:** 7
**Open confirmed P0/P1 product defects:** 0

This document distinguishes product defects from test-harness defects. A broken
seed script or stale test image is not evidence of an app defect, and a green
test must not be used to hide a real failure.

## 1. Defects fixed

| ID | Class | Severity | Defect | Root cause | Fix | Regression evidence |
| --- | --- | --- | --- | --- | --- | --- |
| DOCKER-001 | Migration / environment | P1 test-blocker | Fresh Supabase migration failed with a duplicate `schema_migrations` primary key / `MigrationApplyError` | Two migration files shared version `20261021000000` | Renamed `20261021000000_incident_evidence_storage.sql` to `20261022000006_incident_evidence_storage.sql`; updated references | `reset-test-data.sh` exit 0; all 44 migrations applied; no duplicate versions |
| DOCKER-002 | Test fixture | P1 test-blocker | Re-running the seed failed with `Database error deleting user` | Synthetic users owned RESTRICT-referenced jobs, bookings, invoices, attendance, payments, and disputes | Added FK-safe dependency cleanup before profile/Auth deletion | Seed ran repeatedly against the same DB; final container seed exit 0 |
| DOCKER-003 | Test security / isolation | P1 | Admin compose service received the full test env file, including the service-role key | `env_file` supplied all test values to an app container | Removed `env_file` from Admin; injected only anon/public values; added smoke assertion | `run-smoke-tests.sh` checks Admin/Worker/Organizer for the key; result PASS, key ABSENT |
| DOCKER-004 | Legacy harness | P2 | Phase 4 marketplace test failed admin KYC approval with `UNAUTHORIZED` | Its fixture used `ON CONFLICT (id) DO UPDATE SET is_active = true`, so the auth-trigger-created worker profile was never promoted to admin | Changed conflict update to set `role = EXCLUDED.role`; also made SSL conditional for local PostgreSQL | Phase 4 marketplace test: 12/12 steps, exit 0 |
| DOCKER-005 | Test runner process | P2 | Container UI run reported 14/18 while the host run was 18/18 | `opskl-test-runner:test` had not been rebuilt after seed/UI script changes | Rebuilt the runner image and reran | Final container UI: 18/18, exit 0 |
| DOCKER-006 | Test assertions | P3 | API test reported three false failures | Tests used `p_status` instead of `p_new_status`; expected `offered` instead of `selected_awaiting_confirmation`; treated idempotent duplicate check-in as an error | Corrected assertions and documented idempotency | API workflow: 41/41, exit 0 |
| DOCKER-007 | Test fixture design | P3 | Worker UI saw `0 LIVE` after seeding one shift | The discovery feed deliberately excludes shifts the current worker already applied to, and the seed applied the only shift | Added a second untouched `Docker Test Open Discovery Shift` for the worker feed | Worker UI shows the open discovery shift; organizer keeps the applied shift |

## 2. Non-defects investigated

These were investigated and are **not** product defects:

| Observation | Finding |
| --- | --- |
| Worker feed showed zero after seed | Expected feed exclusion for an already-applied shift; fixture design issue, fixed with a second shift |
| Organizer screen briefly showed `Organizer account`/`Unverified Enterprise` | Browser assertion raced the profile fetch; after waiting for the business name, the verified profile rendered correctly. No auth or RLS failure |
| Admin rejected worker login did not expose an error immediately in one early harness run | Error appears after the real Auth request and profile role check; the final assertion waits for the visible access-denied state |
| Duplicate check-in returned success | Backend returns idempotent success with `already_checked_in: true`; no duplicate attendance row is created |
| `docker compose ps` showed `health: starting` immediately after startup | Snapshot was taken before the health interval elapsed; HTTP readiness probes and later inspection showed all containers healthy |
| Admin SSR/browser URL mismatch in containers | Handled by a loopback proxy inside the Admin image; not an app-code change. The app image still uses only public credentials |

## 3. Existing product-defect record

The earlier audit remediation remains the authoritative product-defect record.
At the last consolidated count:

- 32 defects identified;
- 6 P0, 22 P1, 2 P2, 2 P3;
- 30 fixed;
- 0 confirmed P0/P1 open;
- 2 P3 open.

See:

- `docs/audit/BUG_LEDGER.md`
- `docs/audit/BUG_FIX_SUMMARY.md`
- `docs/audit/REGRESSION_TEST_MATRIX.md`
- `docs/audit/REMAINING_BLOCKERS.md`

The Dockerization pass added no new confirmed product defect. It did expose
test-environment issues that could otherwise have produced false PASS or false
FAIL results.

## 4. Failure history transparency

The first containerized UI attempt failed 4 checks (14/18). The failing checks
were caused by the stale runner image and the one-shift fixture design, both
listed above. The suite was not marked green until:

- the runner image was rebuilt;
- the seed created a second, un-applied shift;
- the UI waited for the organizer profile fetch;
- the Admin denial assertion waited for the rendered access-denied state.

Final container run: **API 41/41 PASS, UI 18/18 PASS, runner exit 0**.
