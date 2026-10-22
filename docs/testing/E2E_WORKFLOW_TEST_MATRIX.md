# End-to-end workflow test matrix

**Scope:** local Supabase + Dockerized Admin/Worker/Organizer web targets.
**Run:** 2026-10-22.
**Result:** API/RLS **41/41 PASS**; browser **18/18 PASS**; fresh-DB lifecycle
**69/69 PASS**; full workflow **52/52 PASS**; SQL integration **56 checks PASS**;
Phase 4 marketplace **12/12 steps PASS**.

A `PASS` below means the named check executed and returned the expected result.
It does not mean the equivalent native or provider workflow was tested.

## 1. Authentication and authorization

| Workflow | Execution | Result | Evidence |
| --- | --- | --- | --- |
| Unauthenticated Admin route redirects to login | Chromium | **PASS** | `ui-checks.json` check 1 |
| Worker credentials rejected by Admin portal | Chromium, real GoTrue | **PASS** | `ui-checks.json` check 2 |
| Admin password login reaches dashboard | Chromium, real GoTrue | **PASS** | `ui-checks.json` check 3 |
| Worker password login reaches worker feed | Chromium, real GoTrue | **PASS** | `ui-checks.json` check 10 |
| Organizer password login reaches dashboard | Chromium, real GoTrue | **PASS** | `ui-checks.json` check 14 |
| Unauthenticated read of KYC cases blocked | PostgREST anon client | **PASS** | `api-rpc-rls.log`, `[1]` |
| Worker cannot invoke admin KYC approval | Authenticated PostgREST | **PASS** | `api-rpc-rls.log`, `[1]` |
| Organizer cannot invoke admin settlement | Authenticated PostgREST | **PASS** | `api-rpc-rls.log`, `[1]` |
| Worker cannot read organizer invoices | RLS | **PASS** | `api-rpc-rls.log`, `[1]` |
| Admin identity is active admin | Service verification | **PASS** | `api-rpc-rls.log`, `[1]` |
| `is_current_admin` true for admin, false for worker | RPC | **PASS** | `api-rpc-rls.log`, `[6]` |
| Direct role escalation blocked | SQL/trigger suite | **PASS** | `lifecycle-db.log`, `sql-integration.log` |
| Unverified organizer cannot create a live shift | SQL integration | **PASS** | `sql-integration.log` |

## 2. Shift publication and discovery

| Workflow | Execution | Result | Evidence |
| --- | --- | --- | --- |
| Verified organizer publishes shift | Authenticated RPC | **PASS** | `api-rpc-rls.log`, `[2]` |
| Worker cannot publish on behalf of organizer | Authenticated RPC | **PASS** | `api-rpc-rls.log`, `[2]` |
| Server derives pay from rate and hours | DB verification | **PASS** | `api-rpc-rls.log`, `[2]` |
| Worker discovery feed contains open shift | Authenticated RPC | **PASS** | `api-rpc-rls.log`, `[3]` |
| Worker feed renders seeded open shift | Chromium | **PASS** | `worker-feed.png`, `ui-checks.json` check 12 |
| Feed excludes shifts the worker already applied to | Fixture design + UI | **PASS** | two seeded shifts; worker feed shows the untouched one |
| Duplicate identical publication blocked | SQL integration | **PASS** | `sql-integration.log` |

## 3. Application and offer lifecycle

| Workflow | Execution | Result | Evidence |
| --- | --- | --- | --- |
| Worker applies to shift | Authenticated RPC | **PASS** | `api-rpc-rls.log`, `[3]` |
| Application is not stored as confirmed/hired | DB verification | **PASS** | `api-rpc-rls.log`, `[3]` |
| Applying does not create a booking | DB verification | **PASS** | `api-rpc-rls.log`, `[3]` |
| Duplicate application rejected safely | Authenticated RPC | **PASS** | `api-rpc-rls.log`, `[3]` |
| Organizer shortlists applicant | Authenticated RPC | **PASS** | `api-rpc-rls.log`, `[3]` |
| Organizer sends offer | Authenticated RPC | **PASS** | `api-rpc-rls.log`, `[4]` |
| Offer includes server-generated attendance code | RPC response | **PASS** | `api-rpc-rls.log`, `[4]` |
| Booking awaits worker confirmation | DB verification | **PASS** | status `selected_awaiting_confirmation` |
| Duplicate offer for filled slot rejected | Authenticated RPC | **PASS** | `api-rpc-rls.log`, `[4]` |
| Worker accepts offer | Authenticated RPC | **PASS** | `api-rpc-rls.log`, `[4]` |
| Duplicate acceptance does not add a booking | Authenticated RPC + DB | **PASS** | `api-rpc-rls.log`, `[4]` |
| Job becomes filled after acceptance | DB verification | **PASS** | `api-rpc-rls.log`, `[4]` |
| No overbooking or duplicate active assignment | DB verification | **PASS** | one confirmed booking |
| Second worker cannot exceed capacity | SQL integration | **PASS** | `sql-integration.log`; Phase 4 step 11 |
| Cross-account confirmation blocked | SQL integration | **PASS** | Phase 4 step 12 |

## 4. Attendance lifecycle

| Workflow | Execution | Result | Evidence |
| --- | --- | --- | --- |
| Invalid attendance code rejected | Authenticated RPC | **PASS** | `api-rpc-rls.log`, `[5]` |
| Check-in outside 300 m geofence rejected | Authenticated RPC | **PASS** | `api-rpc-rls.log`, `[5]` |
| Check-in at venue geofence succeeds | Authenticated RPC | **PASS** | `api-rpc-rls.log`, `[5]` |
| Duplicate check-in is idempotent and flagged | Authenticated RPC | **PASS** | `already_checked_in: true` |
| Check-out succeeds after minimum duration | Authenticated RPC | **PASS** | `api-rpc-rls.log`, `[5]` |
| Organizer approves attendance and pay | Authenticated RPC | **PASS** | `api-rpc-rls.log`, `[5]` |
| Booking completed with approved pay | DB verification | **PASS** | `approved_total_pay = 4000` |
| Worker completed-shift counter increments | DB lifecycle | **PASS** | `full-workflow-db.log` |
| Manual supervisor override contracts | SQL integration | **PASS** | `sql-integration.log` |

The checkout test advances disposable attendance timestamps with the
service-role client so the 15-minute minimum does not require real waiting. The
checkout RPC still performs its own validation; this is not a product bypass.

## 5. Financial lifecycle (test ledger only)

| Workflow | Execution | Result | Evidence |
| --- | --- | --- | --- |
| Organizer generates invoice | Authenticated RPC | **PASS** | `api-rpc-rls.log`, `[6]` |
| Invoice is issued with server total | DB verification | **PASS** | `api-rpc-rls.log`, `[6]` |
| Admin marks invoice funded | Authenticated admin RPC | **PASS** | reference `TEST-DOCKER-FUNDING-*` |
| Organizer initiates payout | Authenticated RPC | **PASS** | status `escrow_locked` |
| Payout amount equals approved pay | RPC response | **PASS** | 4000 |
| Payout idempotency key reuses payment | Authenticated RPC | **PASS** | same `payment_id` |
| Admin settles payout with test UTR | Authenticated admin RPC | **PASS** | status `settled` |
| Payment ledger stores settled amount and UTR | DB verification | **PASS** | `net_payout = 4000` |
| Re-settlement with different UTR rejected | Authenticated admin RPC | **PASS** | `api-rpc-rls.log`, `[6]` |

No payment provider, escrow account, bank, or real money is involved. These are
ledger-state transitions in the disposable DB and must not be reported as
provider settlement verification.

## 6. Admin screens

| Workflow | Execution | Result | Evidence |
| --- | --- | --- | --- |
| Admin dashboard renders operational queues | Chromium | **PASS** | `admin-dashboard.png` |
| Verification queue is reachable | Chromium | **PASS** | `admin-verifications.png` |
| Seeded synthetic KYC cases visible | Chromium | **PASS** | worker and organizer identities |
| Disputes center reachable | Chromium | **PASS** | `ui-checks.json` check 7 |
| Audit log reachable | Chromium | **PASS** | `ui-checks.json` check 8 |
| No uncaught Admin page errors | Chromium | **PASS** | `ui-checks.json` check 9 |
| Admin KYC approval through the UI | Not executed | **NOT COVERED** | approval was exercised via RPC/API only |
| Admin dispute resolution through the UI | Not executed | **NOT COVERED** | queue rendering only |

## 7. Worker and Organizer screens

| Workflow | Execution | Result | Evidence |
| --- | --- | --- | --- |
| Worker feed renders | Chromium | **PASS** | `worker-feed.png` |
| Seeded shift appears in worker feed | Chromium | **PASS** | `ui-checks.json` check 12 |
| No uncaught Worker page errors | Chromium | **PASS** | `ui-checks.json` check 13 |
| Organizer dashboard shows verified business | Chromium | **PASS** | `organizer-dashboard.png` |
| Organizer dashboard shows seeded shift | Chromium | **PASS** | `ui-checks.json` check 16 |
| Organizer roster route renders | Chromium | **PASS** | `organizer-roster.png` |
| No uncaught Organizer page errors | Chromium | **PASS** | `ui-checks.json` check 18 |
| Organizer offer/accept/shortlist through UI | Not executed | **NOT COVERED** | exercised through API/RPC |
| Worker apply/check-in through UI | Not executed | **NOT COVERED** | exercised through API/RPC |

## 8. Fresh database and migration checks

| Check | Execution | Result | Evidence |
| --- | --- | --- | --- |
| 44 migrations apply to a fresh DB | `supabase db reset` | **PASS** | `db-reset.log` |
| No duplicate migration versions | filesystem check | **PASS** | 44 versions, zero duplicates |
| Lifecycle/RLS/trigger suite | PostgreSQL transaction | **PASS** | 69/69 |
| Full three-role DB workflow | PostgreSQL transaction | **PASS** | 52/52 |
| SQL logic and hardening suite | PostgreSQL transaction | **PASS** | 56 checks |
| Phase 4 marketplace lifecycle | Real Auth + direct DB | **PASS** | 12/12 steps |
| Existing unit/static suites | `npm test` | **PASS** | 32 suites, 390 tests |
| Brutal static contracts | `npm run test:brutal` | **PASS** | 17/17 |
| TypeScript | `npm run typecheck` | **PASS** | exit 0 |
| Lint | `npm run lint` | **PASS** | exit 0 |
| Admin production build | `CI=1 npm run build:admin` | **PASS** | exit 0 |

## 9. Explicitly not covered

These are blocked or unverified, not passed:

- native iOS/Android launch, signing, store builds, simulators, or devices;
- native camera, GPS, permission prompts, background execution, push delivery;
- offline queue/replay on a device;
- real SMTP, SMS, OTP, APNs, or FCM;
- real Razorpay/escrow/payment webhooks or provider settlement;
- Supabase Realtime delivery assertions;
- Edge Function execution;
- Safari and Firefox;
- production/staging schema drift, connection pooler, JWT secret rotation,
  HA, load, and performance;
- visual regression and manual accessibility review.
