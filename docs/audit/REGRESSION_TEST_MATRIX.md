# Opskl Regression Test Matrix

**Date:** 22 October 2026  
**Environment:** macOS (darwin), Node.js v26.11.1, npm 11.20.0, disposable PostgreSQL container `opskil-pg` on `127.0.0.1:55432`, Supabase-compatible bootstrap (`auth.uid()`, `auth.role()`, `auth.jwt()`, roles `anon`/`authenticated`/`service_role`).  
**Rule:** This matrix records what actually ran. It does not claim production, device, provider, or real-money verification.

---

## 1. Final verification gates

| Gate | Command | Result | Exit | Environment / scope |
| :--- | :--- | :--- | :---: | :--- |
| TypeScript | `npm run typecheck` | All workspaces clean | **0** | Local, static |
| Unit / component | `npm test` | 32 suites, **390 tests** (shared 314, validation 7, worker 38, organizer 31) | **0** | Local, mocked/Jest |
| Lint | `npm run lint` | All workspaces clean | **0** | Local, static |
| Admin production build | `CI=1 npm run build:admin` | Next.js build complete | **0** | Local compile |
| Database lifecycle | `DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/opskil' npm run test:db` | **69/69 checks pass** | **0** | Real PostgreSQL, fresh migrations, rolled back |
| Full three-role workflow | `DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/opskil' node scripts/test_full_workflow_db.mjs` | **52/52 checks pass** | **0** | Real PostgreSQL, fresh migrations, rolled back |
| SQL invariants + live catalog | `DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/opskil' node scripts/test_sql_integration.mjs` | **34/34 static invariants** + live catalog/RPC suite pass | **0** | Real PostgreSQL |
| Prior-phase security suite | `npm --workspace=@opskil/shared test -- bug_hunting_and_capacity_regression` | 11/11 | **0** | Jest |
| Registration security | `npm --workspace=@opskil/shared test -- registration_security_regression` | 11/11 | **0** | Jest |
| Security remediation | `npm --workspace=@opskil/shared test -- security_audit_remediation_p0_p1` | 11/11 | **0** | Jest |
| Static lifecycle contracts | `npm --workspace=@opskil/shared test -- lifecycle_contract_regression` | 17/17 | **0** | Jest, source-text contracts |

### Not run / unverified

| Gate | Reason |
| :--- | :--- |
| Admin Playwright E2E | Not executed: `apps/admin/.env.local` points at a remote Supabase project, so running the login/dashboard spec could touch non-disposable data. Browser/login flow was source- and build-checked only. |
| Worker/organizer iOS/Android simulator or device flows | No simulator/device run; GPS, camera, dialer, and push behaviour unverified. |
| Production/staging migration and RLS state | No Supabase production/staging credentials. |
| Razorpay/UPI/escrow webhooks | Provider integration does not exist; manual reconciliation only. |
| Real OTP/SMS/email delivery | No provider credentials; not triggered. |
| APNs/FCM delivery | No credentials; not triggered. |
| Load / concurrency soak / penetration test | Not performed; row-lock logic tested functionally only. |

---

## 2. Defect-to-test mapping

### P0

| Bug | Defect | Regression evidence | Type | Command | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **BUG-005** | Missing `bookings.created_at`/`updated_at` | DB sections `[1]`, `[3]`, `[5]`, `[7b]`, `[7c]`, `[8]`; static “restores the missing booking audit columns used by lifecycle RPCs” | Real DB + static | `npm run test:db`; lifecycle contract | **PASS** |
| **BUG-006** | `check_in_worker_safe` wrong columns / duplicate / geofence bypass | DB `[3]` “one attendance row created”, IDs present, “repeat check-in is idempotent”; `[4]` missing GPS and out-of-range; “anon cannot execute check-in”; static “writes only columns that exist on attendance_records” | Real DB + static | `npm run test:db` | **PASS** |
| **BUG-007** | Ambiguous completion overload / unverified pay | DB `[5]` pay = 8h×500, persisted pay/hours/verification, non-owner rejected, counter increment; static “removes the ambiguous completion overload” | Real DB + static | `npm run test:db` | **PASS** |
| **BUG-008** | `is_current_admin()` always true | DB `[9b]` active admin recognized, deactivated admin loses privilege; `[6]` non-admin dispute denied; `[8]` worker cannot settle; static “does not trust current_user inside SECURITY DEFINER for admin checks” | Real DB + static | `npm run test:db` | **PASS** |
| **BUG-009** | Trigger privilege escalation / KYC self-verify | DB `[9c]` nine checks (self-verify, promote, activation, organizer verify, direct booking/invoice/payout tamper, forged notification, valid UPI update); static “does not let SECURITY DEFINER trigger ownership bypass verification guards” | Real DB + static | `npm run test:db` | **PASS** |
| **BUG-001** | Unauthenticated admin user API | `bug_hunting_and_capacity_regression.test.ts`: 401 unauthenticated, 403 non-admin, audit actor, rollback | Jest | `npm test` | **PASS** |

### P1

| Bug | Defect | Regression evidence | Type | Command | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **BUG-010** | Dispute columns / wrong RPC arg | DB `[6]` resolve succeeds, assigned + timestamped, adjusted payout, non-admin denied; static “sends the dispute booking outcome instead of an ignored admin id” | Real DB + static | `npm run test:db` | **PASS** |
| **BUG-011** | `payment_records.updated_at` missing | DB `[8]` initiation, settlement, reconciliation | Real DB | `npm run test:db` | **PASS** |
| **BUG-012** | Invalid enum `'closed'` | DB `[1]` “repeat confirmation is idempotent”; static “never compares shift_status to the non-existent closed literal” | Real DB + static | `npm run test:db` | **PASS** |
| **BUG-013** | Fiscal sequence client-writable | DB `[9]` RLS enabled, authenticated UPDATE denied, anon SELECT denied; static “applies RLS and removes client DML from the fiscal sequence” | Real DB + static | `npm run test:db` | **PASS** |
| **BUG-014** | Payout settlement no state/idempotency guard | DB `[8]` worker denied, admin settles escrow-locked, same UTR idempotent, different UTR rejected | Real DB | `npm run test:db` | **PASS** |
| **BUG-015** | UPI regex `{2,256}` invalid | DB `[9c]` “worker can still update their own UPI handle” | Real DB | `npm run test:db` | **PASS** |
| **BUG-016** | Check-in fallback to unrelated booking | Static “never checks in against an unrelated fallback booking” | Source contract | lifecycle contract test | **PASS** |
| **BUG-017** | Screening fake success | Static “does not fake screening success when the mutation fails” | Source contract | lifecycle contract test | **PASS** |
| **BUG-018** | Onboarding UPI trap | Static “marks the worker profile complete even when UPI is deferred” | Source contract | lifecycle contract test | **PASS** |
| **BUG-019** | Fabricated pass/PIN/timer/mapper | Static “never fabricates a check-in pass code or rotating token UI”; DB `[1]` server issues real code | Source + real DB | both | **PASS** |
| **BUG-020** | Misleading UPI disbursement / no-op PDF | Static “does not claim UPI disbursement without a payout rail” | Source contract | lifecycle contract test | **PASS** |
| **BUG-021** | Hardcoded ₹14,400 / automated claim | Static “does not hardcode fabricated organizer wage pools or automated payouts” | Source contract | lifecycle contract test | **PASS** |
| **BUG-022** | Admin open redirect | Static “sanitizes the admin post-login redirect” | Source contract | lifecycle contract test | **PASS** |
| **BUG-024** | Invoice allocator client-executable | DB `[9]` “invoice allocator is not client-executable” | Real DB | `npm run test:db` | **PASS** |
| **BUG-025** | Invoice UTR submission `anon` executable | DB `[9]` “invoice UTR submission is authenticated-only” | Real DB | `npm run test:db` | **PASS** |
| **BUG-002** | Capacity drift/underflow | 3 capacity tests in `bug_hunting_and_capacity_regression.test.ts`; SQL invariant 3.6 | Jest + real DB catalog | `npm test` + `test:sql` | **PASS** |
| **BUG-003** | Timezone drift in offer sweep | 2 timezone tests in `bug_hunting_and_capacity_regression.test.ts`; SQL invariant 3.7 | Jest + real DB catalog | `npm test` + `test:sql` | **PASS** |
| **BUG-026** | Unauthenticated push webhook | `security_audit_remediation_p0_p1.test.ts` “rejects unauthorized incoming webhook tokens” | Jest | `npm test` | **PASS** |
| **BUG-027** | Registration rate limit / verification bypass | `registration_security_regression.test.ts` 11/11; DB “account-takeover registration RPC is gone” | Jest + real DB | `npm test` + `test:db` | **PASS** |
| **BUG-028** | Public views expose supervisor/GSTIN | `test_sql_integration.mjs` static + live view checks | Real DB | `test:sql` | **PASS** |
| **BUG-029** | Invoice authorization / immutability | SQL invariants 3.4 + paid-invoice lock; DB `[7]` foreign organizer denied | Real DB | `test:sql` + `test:db` | **PASS** |
| **BUG-032** | Organizer role switch blocked by escalation guard | Workflow `[1]` worker→organizer switch succeeds, organizer subprofile created, switch-back succeeds, direct role update still rejected; static “allows worker/organizer switching only through the trusted RPC window” | Real DB + static | `test_full_workflow_db.mjs` + lifecycle contract | **PASS** |

### P2

| Bug | Defect | Regression evidence | Type | Command | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **BUG-004** | Dialer unhandled rejection | `bug_hunting_and_capacity_regression.test.ts`: dialer failure alert, corrupt phone rejection | Jest | `npm test` | **PASS** |
| **BUG-023** | Static offline gate code | Static “generates a non-static offline gate code” | Source contract | lifecycle contract test | **PASS** |

### P3 (open — no fix claimed)

| Bug | Observation | Verification status |
| :--- | :--- | :--- |
| **BUG-030** | `current_user` bypass in three legacy RPC auth checks | Not exploitable under current `authenticated`-only grants and downstream checks; no regression test because not fixed. |
| **BUG-031** | `submit_review_safe` leaves `opskl.trusted='1'` for the rest of the transaction | Transaction-local; no cross-request path found. Not fixed. |

---

## 3. Database lifecycle suite detail (69 checks)

The suite (`scripts/test_lifecycle_db.mjs`) starts a transaction, creates synthetic users/profiles/jobs/bookings, exercises real RPCs, performs negative RLS/trigger probes, and rolls everything back. No real customer data is used.

| Section | Coverage | Checks |
| :--- | :--- | :---: |
| `[1]` | Worker confirms offer; idempotent re-confirm | 5 |
| `[2]` | Overlapping shift rejected | 1 |
| `[3]` | Check-in creates one valid attendance row; repeat is idempotent | 4 |
| `[4]` | Missing GPS rejected; distant check-in rejected | 2 |
| `[5]` | Completion derives pay from verified 8h × ₹500; non-owner denied; counter increments | 7 |
| `[6]` | Admin dispute resolution; columns/timestamps; non-admin denied | 4 |
| `[7]` | Foreign organizer cannot invoice | 1 |
| `[7b]` | Apply → shortlist → confirm → check-in → checkout (15-min minimum) | 8 |
| `[7c]` | No-show and cancellation transitions | 4 |
| `[8]` | Invoice, payout initiation, idempotency, settlement state machine | 10 |
| `[9b]` | Tenant isolation and admin deactivation | 4 |
| `[9c]` | Direct-table privilege escalation, RLS tampering, notification forgery, valid UPI update | 9 |
| `[9]` | Fiscal RLS/grants, anon execute denials, legacy RPC absence, function grants | 10 |
| **Total** | | **69** |

---

## 3b. Full three-role workflow suite detail (52 checks)

`scripts/test_full_workflow_db.mjs` starts from the post-auth signup path, then exercises worker, organizer, and admin duties through the real RPCs. It runs in one transaction and rolls back.

| Section | Coverage | Checks |
| :--- | :--- | :---: |
| `[1]` | Signup metadata → profiles/subprofiles; provisioning RPC; worker→organizer switch and back; direct role change denied; unverified starts | 10 |
| `[2]` | Worker onboarding, UPI, profile completion, pending KYC case | 3 |
| `[3]` | Admin approves worker KYC; verified/Aadhaar flags persist | 3 |
| `[4]` | Organizer onboarding; unverified posting denied; GSTIN case; admin approval; verified/GSTIN flags | 5 |
| `[5]` | Verified organizer posts a future shift; open status, slots, derived pay | 4 |
| `[6]` | Worker discovery feed; apply; organizer application list; shortlist; offer with server code; accept; booking/job capacity | 10 |
| `[7]` | Check-in inside geofence; checkout after minimum duration; attendance approval; approved pay; completed counter | 5 |
| `[8]` | Invoice issued; admin marks funded; payout initiated; approved amount; admin settles; ledger UTR; different-UTR rejection | 8 |
| `[9]` | Admin predicate; worker is not admin; worker cannot post for organizer; approved KYC persists | 4 |
| **Total** | | **52** |

**What this proves:** the database-backed journeys for all three roles are wired and authorized correctly, including verification gates, capacity, attendance, manual invoice funding, payout state, and settlement idempotency.

**What this does not prove:** login UI/OTP delivery, mobile GPS/permissions, browser rendering, or real bank/provider settlement. Those require the external environments listed in §1 “Not run / unverified” and `REMAINING_BLOCKERS.md`.

---

## 4. Static SQL invariant detail (34 checks)

`scripts/test_sql_integration.mjs` combines source invariants with a live catalog phase:

- 34/34 source invariants (RPC definitions, guards, enum literals, timezone instants, capacity recalculation, view column shielding, rate limiting).
- Live phase: connects to PostgreSQL, verifies 13 core functions compile, verifies final `is_current_admin()` enforces `is_active`, checks public view columns, executes `create_job_safe` negative cases (coordinates, unverified organizer, non-initial status, past start, break bounds, venue length, minimum wage), verifies deadlines/payable hours/duplicate throttle, verifies role-escalation trigger denial, then rolls back.
- **Exit code 0** with `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/opskil`.

The live fixture inserts one synthetic `auth.users` row (`verification-enterprise@example.test`) solely to satisfy the real `profiles_id_fkey`; it is rolled back and is not a real person or customer.

---

## 5. Reproducibility commands

```bash
# 1. Static / unit gates
npm run typecheck
npm test
npm run lint
CI=1 npm run build:admin

# 2. Fresh disposable database (already provisioned as opskil-pg)
#    dropdb/createdb, apply bootstrap.sql, then all supabase/migrations/*.sql in sorted order

# 3. Database-backed lifecycle suite (69 checks)
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/opskil' npm run test:db

# 4. Full three-role workflow (52 checks)
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/opskil' node scripts/test_full_workflow_db.mjs

# 5. SQL invariants + live catalog (34 static + live checks)
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/opskil' node scripts/test_sql_integration.mjs
```

All gates above exited **0** on the final tree. The database suites are local/disposable; they are not production verification.
