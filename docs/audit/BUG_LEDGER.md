# Opskl Defect & Remediation Ledger

**Audit date:** 22 October 2026  
**Scope:** Worker app, organizer app, admin console, shared/validation packages, Supabase migrations, RPCs, Edge Functions, and the disposable PostgreSQL database used for behavioural verification.  
**Method:** Source inspection + fresh-database migration replay + executable RPC lifecycle tests + RLS/trigger negative tests + static source contracts. Prior audit reports were treated as claims, not evidence.

> **Evidence boundary:** No production or staging Supabase credentials, payment-provider keys, OTP/SMS providers, APNs/FCM credentials, or physical devices were available. Production deployment state, provider webhooks, real money movement, real OTP delivery, and on-device GPS behaviour remain unverified. This ledger does not claim otherwise.

---

## 1. Summary

| Severity | Discovered | Fixed & verified locally | Open |
| :--- | :---: | :---: | :---: |
| **P0 — Critical security / financial / core lifecycle** | 6 | 6 | 0 |
| **P1 — High integrity / authorization / misleading behaviour** | 22 | 22 | 0 |
| **P2 — Medium reliability / interaction** | 2 | 2 | 0 |
| **P3 — Low defence-in-depth / hardening** | 2 | 0 | 2 |
| **Total** | **32** | **30** | **2** |

Open P3 items are latent hardening gaps, not confirmed exploitable paths under the current grants and RLS policies. They are listed in §4 and in `REMAINING_BLOCKERS.md`.

---

## 2. P0 defects (all fixed)

### BUG-005 [P0 — Core lifecycle] Missing `bookings.created_at` / `bookings.updated_at`
- **Affected:** `bookings` table; `worker_confirm_selection_safe`, `check_in_worker_safe`, `complete_shift_and_approve_attendance`, cancellation/no-show paths.
- **Reproduction:** On a fresh database built only from `supabase/migrations/*.sql`, confirm an offer or complete a shift. PostgreSQL returned `SQLSTATE 42703: column "updated_at" does not exist` (and `created_at` was likewise absent from the deployed contract).
- **Impact:** Core worker lifecycle failed at the database layer. Mocked unit tests could not detect it because they never executed the SQL.
- **Root cause:** The lifecycle RPCs were written against an assumed `bookings` schema that the migration history did not actually create. No fresh-database contract test existed.
- **Fix:** `supabase/migrations/20261022000001_fix_attendance_contracts_and_fiscal_rls.sql` adds both audit columns idempotently with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- **Regression evidence:** `scripts/test_lifecycle_db.mjs` sections `[1]`, `[3]`, `[5]`, `[7b]`, `[7c]`, `[8]`; static contract test “restores the missing booking audit columns used by lifecycle RPCs”.
- **Status:** **FIXED & VERIFIED.**

### BUG-006 [P0 — Attendance contract] `check_in_worker_safe` wrote non-existent columns and could duplicate attendance
- **Affected:** `supabase/migrations/*` → `check_in_worker_safe`.
- **Reproduction:** Call check-in on a confirmed booking. The function referenced attendance columns that do not exist in the canonical schema, omitted required `job_id` / `worker_id`, and a repeated call could insert a second attendance row. Missing coordinates bypassed the geofence path instead of failing closed.
- **Impact:** Check-in could fail entirely, create orphan/duplicate attendance, or weaken the GPS control.
- **Root cause:** RPC schema drift plus a non-idempotent insert. The geofence was enforced only on a conditional branch rather than as a mandatory precondition.
- **Fix:** Rewrote the function in `20261022000001...`: writes only real columns, always sets `booking_id`/`job_id`/`worker_id`, reuses an existing attendance row, and requires valid coordinates inside the 300 m Haversine radius.
- **Regression evidence:** DB checks `[3]` (row created, IDs present, repeat call idempotent), `[4]` (missing GPS → `GPS_COORDINATES_REQUIRED`; distant point → `OUT_OF_GEOFENCE_RANGE`), and `anon cannot execute check-in`.
- **Status:** **FIXED & VERIFIED.**

### BUG-007 [P0 — Attendance/pay contract] Ambiguous completion overload and unverified pay calculation
- **Affected:** `complete_shift_and_approve_attendance`.
- **Reproduction:** Two overloads existed (2-argument and 4-argument), making PostgREST resolution ambiguous. The body referenced stale attendance columns, and `approved_total_pay` could be derived from an unverified/requested hours estimate. `worker_profiles.shifts_completed` was never incremented.
- **Impact:** Organizers could approve pay from unverified hours, or the RPC could fail at runtime; worker reputation counters drifted.
- **Root cause:** Additive migration history left an obsolete overload in place; pay was calculated from caller input instead of verified attendance.
- **Fix:** Dropped the 2-argument overload, recreated the 4-argument function, derives hours/pay from verified attendance, clamps invalid values, and increments `shifts_completed` inside a short-lived trusted scope that is reset immediately.
- **Regression evidence:** DB `[5]`: “approved pay equals 8h x 500”, “approved_total_pay persisted”, “attendance verified by supervisor”, “non-owner completion is rejected”, “completed shift counter incremented”. Static contract “removes the ambiguous completion overload”.
- **Status:** **FIXED & VERIFIED.**

### BUG-008 [P0 — Authorization] `is_current_admin()` always returned true
- **Affected:** `public.is_current_admin()`.
- **Reproduction:** Call any admin-gated RPC as a normal worker. The function used `current_user` inside a `SECURITY DEFINER` function; `current_user` is the function owner (`postgres`), not the JWT caller. Every caller therefore satisfied the admin predicate.
- **Impact:** Admin-only RPCs (dispute resolution, invoice funding, payout settlement, admin dashboards) were effectively open to any authenticated caller.
- **Root cause:** Confusion between the execution role of a `SECURITY DEFINER` function and the request identity. No negative test asserted that a worker is denied.
- **Fix:** `20261022000001...` rewrites the predicate to use JWT identity / `profiles.role = 'admin'` and `is_active = true`, with service-role handling explicit.
- **Regression evidence:** DB `[9b]`: “active admin is recognized”, “deactivated admin loses privilege immediately”; DB `[6]`: “non-admin cannot resolve disputes”; `[8]`: “worker cannot settle payout”.
- **Status:** **FIXED & VERIFIED.**

### BUG-009 [P0 — Privilege escalation] Profile protection triggers trusted the definer owner
- **Affected:** `prevent_role_escalation`, `check_worker_profile_update`, `check_organizer_profile_update`.
- **Reproduction:** As an authenticated worker (`SET ROLE authenticated` + worker JWT, with `session_user` not `postgres`), issue direct PostgREST-style table updates:
  - `UPDATE worker_profiles SET verification_status = 'verified'` → succeeded.
  - `UPDATE profiles SET role = 'admin'` → succeeded.
  - `UPDATE profiles SET is_active = false` → succeeded.
  - Organizer equivalent self-verification also succeeded.
- **Impact:** Any signed-in user could self-approve KYC, self-promote to platform admin, and change account activation. This is a full privilege-escalation path using only the public anon key and a normal user JWT.
- **Root cause:** The trigger functions are `SECURITY DEFINER` and used `current_user IN ('postgres', ...)` as a maintenance bypass. Inside the definer, `current_user` is always the owner, so the guard never ran for API callers.
- **Fix:** `supabase/migrations/20261022000004_fix_privilege_escalation_triggers.sql` replaces the bypass with `session_user` (original connection role), JWT service-role claims, and a verified active-admin check. A request-scoped `opskl.trusted` flag remains only for internal RPCs that must update derived fields, and it is reset immediately after the update.
- **Regression evidence:** DB `[9c]` nine checks: worker cannot self-verify KYC, cannot promote to admin, cannot change activation, organizer cannot self-verify, cannot edit approved pay, cannot fund invoices, cannot settle payouts, cannot forge another user’s notification; worker can still update their own UPI handle. Static contract test “does not let SECURITY DEFINER trigger ownership bypass verification guards”.
- **Status:** **FIXED & VERIFIED.**

### BUG-001 [P0 — Admin API] Unauthenticated admin user mutation endpoint
- **Affected:** `apps/admin/src/middleware.ts`, `apps/admin/src/app/api/admin/users/route.ts`.
- **Reproduction:** Send `POST/PUT/DELETE /api/admin/users` with no session or bearer token. Before the fix, middleware skipped every `/api` path and the route used the service-role client without verifying the caller.
- **Impact:** Anonymous internet callers could create privileged users, set credentials, modify profiles, or deactivate accounts with service-role power.
- **Root cause:** Middleware assumed APIs authenticate themselves; the route assumed middleware had done it. No route-level defence in depth.
- **Fix:** Middleware now authenticates all non-public APIs and requires an active admin profile; the route independently calls `verifyAdminAuth`, attributes `actor_id` in audit logs, and rolls back partial auth/profile creation.
- **Regression evidence:** `packages/shared/src/__tests__/bug_hunting_and_capacity_regression.test.ts`: 401 unauthenticated, 403 non-admin, audit actor attribution, rollback on profile failure (11/11 suite pass).
- **Status:** **FIXED & VERIFIED (source-level; live admin E2E not run).**

---

## 3. P1 defects (all fixed)

### BUG-010 [P1] Dispute adjudication columns missing and client passed the wrong argument
- **Affected:** `disputes` table, `admin_resolve_dispute_safe`, `packages/shared/src/supabase/admin.ts`.
- **Reproduction:** Resolve a dispute as an admin: RPC failed on missing `assigned_to` / `updated_at`; the TypeScript client sent `p_admin_id` while the SQL expected `p_booking_outcome`.
- **Fix:** `20261022000001...` adds the columns; client sends `p_booking_outcome`. DB `[6]` verifies assignment, timestamp, adjusted payout, and non-admin rejection.
- **Status:** **FIXED & VERIFIED.**

### BUG-011 [P1] `payment_records.updated_at` missing
- **Affected:** Payout settlement and reconciliation writes.
- **Reproduction:** Settling or updating a payment raised `42703` on `updated_at`.
- **Fix:** `20261022000001...` adds the column. DB `[8]` exercises initiation, settlement, and reconciliation.
- **Status:** **FIXED & VERIFIED.**

### BUG-012 [P1] Invalid enum literal `'closed'` in `worker_confirm_selection_safe`
- **Affected:** `worker_confirm_selection_safe`.
- **Reproduction:** Re-confirm an already confirmed booking on a terminal job; the function compared `jobs.status` to `'closed'`, which is not a member of `shift_status`, raising `invalid input value for enum shift_status: "closed"`.
- **Fix:** `20261022000002_fix_offer_confirmation_enum_guard.sql` uses only real terminal states (`cancelled`, `completed`) and preserves idempotent confirmation.
- **Regression:** DB `[1]`: “repeat confirmation is idempotent”; static contract “never compares shift_status to the non-existent closed literal”.
- **Status:** **FIXED & VERIFIED.**

### BUG-013 [P1] Fiscal invoice sequence was client-writable
- **Affected:** `invoice_fiscal_sequences`.
- **Reproduction:** As `authenticated`, query/update the sequence table directly; RLS was disabled and DML grants remained.
- **Impact:** Clients could burn or tamper with GST invoice numbers.
- **Fix:** `20261022000001...` enables RLS and revokes all client DML, granting only service-role access. DB `[9]` checks RLS, authenticated UPDATE denial, and anon SELECT denial.
- **Status:** **FIXED & VERIFIED.**

### BUG-014 [P1] Payout settlement had no state machine or idempotency guard
- **Affected:** `admin_mark_payout_settled`.
- **Reproduction:** An admin could mark a `failed`/`refunded` payout as `settled`, settle twice with different UTRs, or write an empty/oversized UTR. The notification then claimed the transfer had occurred.
- **Fix:** `20261022000004...` permits only `escrow_locked`/`processing`, requires a 6–64 character reference, treats the same UTR as idempotent, and rejects a different UTR without a separate reversal workflow.
- **Regression:** DB `[8]`: worker cannot settle, admin can settle escrow-locked payout, same-UTR idempotent, different-UTR rejected.
- **Status:** **FIXED & VERIFIED.**

### BUG-015 [P1] UPI validation regex exceeded PostgreSQL’s repetition limit
- **Affected:** `check_worker_profile_update` UPI validation.
- **Reproduction:** Save a valid UPI such as `self@upi`. PostgreSQL raised `invalid regular expression: invalid repetition count(s)` because `{2,256}` exceeds the engine’s 255 maximum. This also broke any payout profile update path.
- **Fix:** Uses `{2,255}`. DB `[9c]`: “worker can still update their own UPI handle”.
- **Status:** **FIXED & VERIFIED.**

### BUG-016 [P1] Check-in screen fell back to an unrelated booking
- **Affected:** `apps/worker/app/shift/checkin.tsx`.
- **Reproduction:** Open a check-in route with an unknown/missing booking id; the screen selected `bookings[0]` and displayed a pass for a different shift.
- **Impact:** A worker could attempt to check in against the wrong shift.
- **Fix:** Exact id match only; otherwise an explicit empty/error state. Static contract “never checks in against an unrelated fallback booking”.
- **Status:** **FIXED & VERIFIED.**

### BUG-017 [P1] Organizer screening reported success when the mutation failed
- **Affected:** `apps/organizer/app/shift/screening.tsx`.
- **Reproduction:** Force a shortlist/decline RPC failure; the UI used `res.success || true` and showed a success alert.
- **Fix:** Real failure handling with error messages, no optimistic success. Static contract “does not fake screening success when the mutation fails”.
- **Status:** **FIXED & VERIFIED.**

### BUG-018 [P1] Onboarding required UPI before profile completion
- **Affected:** `apps/worker/app/onboarding.tsx`.
- **Reproduction:** Complete onboarding without a UPI handle; validation refused completion even though payouts are manual and UPI can be added later.
- **Fix:** UPI is optional at onboarding; profile can be completed and a payout destination added later. Static contract “marks the worker profile complete even when UPI is deferred”.
- **Status:** **FIXED & VERIFIED.**

### BUG-019 [P1] Fabricated check-in pass, PIN, timer, and mapper
- **Affected:** `apps/worker/src/components/GeofencedCheckInModal.tsx`, related check-in UI.
- **Reproduction:** Inspect the check-in modal: it displayed static codes `8842JW` / `884219`, a rotating-token countdown that was not backed by a server token, and an `OP-xxxx` mapper that could present a code that was never issued.
- **Impact:** Workers could be shown a pass that the backend would never accept — a serious trust/safety defect.
- **Fix:** Removed fabricated values and timer. The UI only displays a server-issued `check_in_code`; if none exists it says so. The server now generates a CSPRNG-backed code at confirmation time (`20261022000002...`), not a hardcoded value.
- **Regression:** Static contract “never fabricates a check-in pass code or rotating token UI”.
- **Status:** **FIXED & VERIFIED.**

### BUG-020 [P1] Worker earnings claimed UPI disbursement and offered a no-op PDF
- **Affected:** `apps/worker/app/(tabs)/earnings.tsx`.
- **Reproduction:** A settled/manual payout displayed “DISBURSED VIA UPI”; the export button claimed a PDF statement but did nothing.
- **Impact:** Misleading financial status — a worker could believe money had been transferred when it was only recorded in the ledger.
- **Fix:** Copy now says “SETTLED — MANUAL RECONCILIATION”; the export action explicitly reports that PDF export is unavailable in this build, with the on-screen ledger as the authoritative record.
- **Regression:** Static contracts “does not claim UPI disbursement without a payout rail” and “marks the worker profile complete even when UPI is deferred”.
- **Status:** **FIXED & VERIFIED.**

### BUG-021 [P1] Organizer finances hardcoded ₹14,400 and claimed automated disbursement
- **Affected:** `apps/organizer/app/(tabs)/finances.tsx`.
- **Reproduction:** Open finances with no data: a hardcoded ₹14,400 pool and copy implying automated bank disbursement appeared.
- **Fix:** Figures derive from the actual ledger; copy states that bank escrow/disbursement is not integrated and settlement is manual.
- **Regression:** Static contract “does not hardcode fabricated organizer wage pools or automated payouts”.
- **Status:** **FIXED & VERIFIED.**

### BUG-022 [P1] Admin login open redirect
- **Affected:** `apps/admin/src/app/login/page.tsx`.
- **Reproduction:** Visit `/login?redirect=https://evil.example` (or `//evil.example`); after login the browser navigated off-origin.
- **Fix:** Only same-origin absolute paths are accepted (`startsWith('/')`, not `//`, not protocol-relative). Static contract “sanitizes the admin post-login redirect”.
- **Status:** **FIXED & VERIFIED.**

### BUG-024 [P1] Invoice number allocator executable by clients
- **Affected:** `generate_invoice_number()`.
- **Reproduction:** As `authenticated` or `anon`, call the allocator directly; it advanced the fiscal sequence, creating gaps or denying invoice issuance.
- **Fix:** `20261022000004...` revokes `PUBLIC`/`anon`/`authenticated` and grants only `service_role`. Internal `SECURITY DEFINER` invoice generation still works.
- **Regression:** DB `[9]`: “invoice allocator is not client-executable”.
- **Status:** **FIXED & VERIFIED.**

### BUG-025 [P1] Invoice UTR submission was executable by `anon`
- **Affected:** `submit_invoice_payment_reference_safe(uuid,text,text)`.
- **Reproduction:** `anon` had `EXECUTE` via `PUBLIC`; the function’s authentication check returned an error, but the grant was unnecessarily broad and fragile.
- **Fix:** `20261022000004...` revokes `PUBLIC`/`anon`, grants `authenticated` and `service_role`.
- **Regression:** DB `[9]`: “invoice UTR submission is authenticated-only”.
- **Status:** **FIXED & VERIFIED.**

### BUG-002 [P1 — prior phase] Capacity drift/underflow on cancellation
- **Affected:** `cancel_booking_safe`, `worker_decline_selection_safe`.
- **Reproduction:** Cancel an uncounted/held booking or race multiple cancellations; `slots_filled = GREATEST(0, slots_filled - 1)` drifted from the real active-booking count.
- **Fix:** Derived count of active bookings under row lock, then set `slots_filled` and status authoritatively (`20261022000000_bug_hunt_capacity_and_auth_hardening.sql`).
- **Regression:** `bug_hunting_and_capacity_regression.test.ts` (3 capacity tests) and SQL invariants check 3.6.
- **Status:** **FIXED & VERIFIED.**

### BUG-003 [P1 — prior phase] Session-timezone drift in offer sweep
- **Affected:** `sweep_expired_worker_offers_safe`.
- **Reproduction:** Assign `now() AT TIME ZONE 'Asia/Kolkata'` to a `TIMESTAMPTZ` in a UTC session; PostgreSQL reinterpreted the wall clock, shifting expiry by 5.5 hours.
- **Fix:** Uses canonical instants `((j.date + j.start_time) AT TIME ZONE 'Asia/Kolkata') <= now()` and rebalances affected jobs.
- **Regression:** `bug_hunting_and_capacity_regression.test.ts` (2 timezone tests) and SQL invariants check 3.7.
- **Status:** **FIXED & VERIFIED.**

### BUG-026 [P1 — prior phase] Push notification webhook accepted unauthenticated calls
- **Affected:** `supabase/functions/dispatch-push-notifications/index.ts`.
- **Reproduction:** POST a forged insert payload to the function without a valid token.
- **Fix:** Requires the service-role key or a high-entropy `WEBHOOK_SECRET`; re-fetches the authoritative notification row and verifies the recipient before dispatching.
- **Regression:** `security_audit_remediation_p0_p1.test.ts` (“rejects unauthorized incoming webhook tokens”).
- **Status:** **FIXED (source/unit verified; live provider delivery not tested).**

### BUG-027 [P1 — prior phase] Registration rate-limit/verification bypass
- **Affected:** `apps/admin/src/app/api/auth/register-user/route.ts` and client signup flow.
- **Reproduction:** Repeated direct registrations bypassed throttling; registration could seed a privileged/verified state.
- **Fix:** Shared atomic rate limiting (IP + normalized contact), role restricted to worker/organizer, `verification_status` starts unverified, service-role route restricted to active admin or internal key, rollback on partial creation.
- **Regression:** `registration_security_regression.test.ts` (full suite pass) and DB check “account-takeover registration RPC is gone”.
- **Status:** **FIXED & VERIFIED.**

### BUG-028 [P1 — prior phase] Public views exposed supervisor/GSTIN/billing data
- **Affected:** `public_jobs`, `public_organizer_cards`.
- **Reproduction:** Inspect view columns; supervisor phone/name or GSTIN/billing address were exposed to public consumers.
- **Fix:** Views project only safe columns.
- **Regression:** `scripts/test_sql_integration.mjs` static + live checks (“public_jobs … shields supervisor contact details”, “public_organizer_cards … shields GSTIN & billing address”).
- **Status:** **FIXED & VERIFIED.**

### BUG-029 [P1 — prior phase] Invoice generation authorization / immutability
- **Affected:** `generate_job_invoice_safe`.
- **Reproduction:** A foreign organizer or unauthenticated caller could attempt invoice generation; paid invoices could be regenerated.
- **Fix:** Strict organizer/admin authorization, actual attended/confirmed staffing billed, paid invoice locked.
- **Regression:** SQL invariants checks 3.4 and “Paid invoice immutability guard”; DB `[7]` foreign organizer denied.
- **Status:** **FIXED & VERIFIED.**

### BUG-032 [P1 — Role switching] Organizer login cannot switch an existing worker account
- **Affected:** `switch_user_role_safe`, `ensure_user_profile_provisioned_safe`, `prevent_role_escalation`.
- **Reproduction:** As an authenticated worker, call `switch_user_role_safe('organizer', ...)` (the exact RPC used by organizer login and “Switch to Organizer Workspace”). PostgreSQL returned `ERROR: Unauthorized: Users cannot change their assigned role.` from `prevent_role_escalation`. The user remained a worker, so organizer login ended in the role-mismatch/signup path.
- **Impact:** Existing worker accounts could not open an organizer workspace. Organizer login for a worker identity failed, and the explicit `/welcome` role-switch path was unusable.
- **Root cause:** The privilege-escalation hardening in `20261022000004...` rejected every role change from a JWT-authenticated session, including authorized `SECURITY DEFINER` RPCs. Tests covered the negative case (“worker must not become admin”) but had no positive test for the trusted worker↔organizer switch, so the over-blocking shipped.
- **Fix:** `supabase/migrations/20261022000005_fix_role_switch_guard.sql` adds a narrowly-scoped transaction-local `opskl.role_switch` window that only `switch_user_role_safe` and `ensure_user_profile_provisioned_safe` set around their own `profiles.role` update. The trigger permits that window and still rejects direct client role changes, including `worker -> admin`.
- **Regression evidence:** `scripts/test_full_workflow_db.mjs` checks worker→organizer switch succeeds, organizer subprofile is created, provisioning can switch back to worker, and a direct authenticated role update is still rejected. Static guard “allows worker/organizer switching only through the trusted RPC window”.
- **Status:** **FIXED & VERIFIED.**

---

## 4. Open P3 hardening items (not confirmed exploitable)

### BUG-030 [P3 — OPEN] `current_user` still used in three legacy RPC auth checks
- **Affected:** `create_job_safe`, `get_organizer_applications_safe`, `sweep_expired_worker_offers_safe`.
- **Observation:** Each contains `current_user <> 'postgres'` as an authentication bypass. Inside `SECURITY DEFINER` this condition is always false, so the bypass is always taken.
- **Why it is not currently exploitable:** These RPCs are granted to `authenticated`, not `anon`. With an authenticated JWT, `auth.uid()` is non-null and the downstream authorization checks still run (`create_job_safe` verifies organizer/team/admin; `get_organizer_applications_safe` filters by caller). `sweep` is a bounded expiry operation.
- **Residual risk:** If a future migration grants these functions to `anon`, or removes the downstream checks, the latent bypass becomes a real authorization gap. Track and replace with `session_user`/JWT identity.
- **Status:** **OPEN — hardening, not launch-blocking under current grants.**

### BUG-031 [P3 — OPEN] `submit_review_safe` does not clear the transaction-local trusted flag
- **Affected:** `submit_review_safe`.
- **Observation:** It calls `set_config('opskl.trusted','1', true)` before updating rating fields and never resets it. The flag is transaction-local, so a normal PostgREST request cannot chain a second statement after the RPC returns; no cross-request exploit was found.
- **Residual risk:** A future RPC that sets the flag and then executes user-influenced SQL in the same transaction would bypass profile guards. Prefer setting and resetting around the exact update, as `complete_shift_and_approve_attendance` now does.
- **Status:** **OPEN — hardening, not launch-blocking.**

---

## 5. Controls verified negatively (no defect found)

| Control | Evidence |
| :--- | :--- |
| Worker cannot read another worker’s booking | DB `[9b]` |
| Deactivated admin loses privileges immediately | DB `[9b]` |
| Worker cannot update approved pay directly | DB `[9c]` (RLS, 0 rows) |
| Organizer cannot mark an invoice funded directly | DB `[9c]` (RLS, 0 rows) |
| Worker cannot mark a payout settled directly | DB `[9c]` (RLS, 0 rows) |
| User cannot forge a notification to another user | DB `[9c]` (RLS error) |
| `anon` cannot execute check-in / completion / payout | DB `[9]` |
| Legacy account-takeover registration RPC absent | DB `[9]` |
| Fiscal table RLS + grants | DB `[9]` |

---

## 6. Verdict

All confirmed P0 and P1 defects are fixed and covered by executable or static regression tests. **P0 remaining: 0. P1 remaining: 0.** Two P3 hardening items remain.

The product is **not** cleared for unrestricted real-money production use. It is cleared only for a **conditional, controlled pilot** with manual reconciliation and the external blockers in `REMAINING_BLOCKERS.md` satisfied.
