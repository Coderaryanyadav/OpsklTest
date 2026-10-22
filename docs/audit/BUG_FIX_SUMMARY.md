# Opskl Bug Fix & Engineering Summary

**Date:** 22 October 2026  
**Scope:** Worker app, organizer app, admin console, shared/validation packages, Supabase migrations/RPCs, Edge Functions.  
**Mode:** Source inspection, fresh-database replay, executable RPC lifecycle tests, RLS/trigger negative tests, independent re-audit.  
**Release verdict:** **CONDITIONAL PILOT ONLY** — all confirmed P0/P1 code defects fixed; unrestricted real-money production is not approved.

---

## 1. Executive summary

The repository contained defects that unit tests could not see because the tests mocked Supabase RPCs and never executed the real SQL. The most serious were:

1. **Core lifecycle failure:** `bookings.created_at` / `updated_at` were missing from the migration-created schema, so confirmation/check-in/completion failed with `SQLSTATE 42703`.
2. **Broken attendance contracts:** check-in wrote non-existent columns, could duplicate rows, and did not fail closed on missing GPS; completion had an ambiguous overload and could approve pay from unverified hours.
3. **Critical privilege escalation:** `is_current_admin()` and profile-protection triggers used `current_user` inside `SECURITY DEFINER`, which is always the function owner. Any signed-in user could self-verify KYC and promote themselves to admin.
4. **Financial state gaps:** payouts could be settled from invalid states or settled twice with different UTRs; the invoice sequence was client-writable and the allocator was client-executable.
5. **Truthfulness defects:** fabricated check-in pass codes/PINs/timers, fake screening success, misleading “disbursed via UPI” copy, a hardcoded ₹14,400 finance pool, and a no-op PDF export.
6. **A PostgreSQL regex portability bug:** `{2,256}` exceeds the engine’s 255 repetition limit, so every valid UPI save failed.
7. **An over-broad privilege guard broke organizer login:** the role-escalation trigger rejected the trusted worker→organizer switch, so existing worker accounts could not open an organizer workspace.

**Result:** 32 defects catalogued (6 P0, 22 P1, 2 P2, 2 P3). 30 fixed and verified locally; 0 P0/P1 open; 2 P3 hardening items remain open and are documented, not hidden.

---

## 2. P0 fixes

| Bug | Fix | Verification |
| :--- | :--- | :--- |
| **BUG-005** Missing booking audit columns | Added idempotent `created_at`/`updated_at` in `20261022000001...` | Real DB lifecycle sections `[1]`–`[8]` |
| **BUG-006** Check-in contract broken | Rewrote `check_in_worker_safe`: real columns, required IDs, idempotent, mandatory geofence | DB `[3]`/`[4]`; anon execute denied |
| **BUG-007** Completion overload/unverified pay | Dropped 2-arg overload; verified-hours pay; counter increment; non-owner denied | DB `[5]` |
| **BUG-008** `is_current_admin()` always true | JWT/profile `is_active` check; no `current_user` | DB `[6]`, `[8]`, `[9b]` |
| **BUG-009** Trigger privilege escalation | `session_user`/JWT/service-role/admin guards in `20261022000004...`; trusted flag scoped and reset | DB `[9c]` nine negative checks |
| **BUG-001** Unauthenticated admin API | Middleware + route-level admin verification, actor attribution, rollback | 11/11 prior-phase suite |

---

## 3. P1/P2 fixes (summary)

- **Disputes:** added `assigned_to`/`updated_at`; client now sends `p_booking_outcome`.
- **Payments:** added `payment_records.updated_at`; payout settlement now allows only `escrow_locked`/`processing`, same-UTR idempotency, different-UTR rejection, 6–64 char reference.
- **Offer confirmation:** removed invalid enum literal `'closed'`; idempotent re-confirm works.
- **Fiscal controls:** RLS on `invoice_fiscal_sequences`; client DML revoked; `generate_invoice_number()` no longer executable by clients; UTR submission no longer `anon`-executable.
- **UPI regex:** `{2,256}` → `{2,255}`; valid UPI update now succeeds.
- **Worker UI:** exact booking match for check-in; no fabricated pass/PIN/timer/mapper; onboarding no longer blocked by missing UPI; earnings says “settled — manual reconciliation” and PDF export reports unavailable.
- **Organizer UI:** screening no longer fakes success; finances use real ledger values and state that escrow/disbursement is not integrated.
- **Admin security:** same-origin post-login redirect only.
- **Organizer role switch:** authorized worker↔organizer switching now runs through a transaction-local trusted window; direct role changes remain blocked (`BUG-032`).
- **Offline gate:** random per-session code instead of a static hash.
- **Prior-phase fixes revalidated:** admin API auth, capacity drift, timezone sweep, dialer rejection handling, push webhook auth, registration throttling/verification, public view PII shielding, invoice authorization/immutability.

---

## 4. Files changed (principal)

### Database / migrations
- `supabase/migrations/20261022000001_fix_attendance_contracts_and_fiscal_rls.sql` — booking audit columns, check-in/completion contracts, `is_current_admin`, dispute columns, fiscal RLS.
- `supabase/migrations/20261022000002_fix_offer_confirmation_enum_guard.sql` — enum guard + server-issued check-in code.
- `supabase/migrations/20261022000004_fix_privilege_escalation_triggers.sql` — trigger identity guards, payout state machine, function grants, UPI regex.
- `supabase/migrations/20261022000005_fix_role_switch_guard.sql` — trusted worker↔organizer switch window; direct role changes still denied.
- `supabase/migrations/20261022000000_bug_hunt_capacity_and_auth_hardening.sql` (prior phase) — capacity recalculation, canonical timezone sweep.

### Tests / harness
- `scripts/test_full_workflow_db.mjs` — **52** real-database checks from signup/provisioning through verification, posting, application, offer, acceptance, attendance, invoice, funding, payout, and settlement.
- `scripts/test_lifecycle_db.mjs` — **69** real-database lifecycle, RLS, trigger, and grant checks.
- `scripts/test_sql_integration.mjs` — **34** static invariants + live catalog/RPC checks; synthetic `auth.users` fixture for the real FK.
- `packages/shared/src/__tests__/lifecycle_contract_regression.test.ts` — **17** source-contract guards.
- `packages/shared/src/__tests__/bug_hunting_and_capacity_regression.test.ts` — **11** prior-phase security/capacity/dialer checks.
- `packages/shared/src/__tests__/registration_security_regression.test.ts` — **11** registration checks.
- `packages/shared/src/__tests__/security_audit_remediation_p0_p1.test.ts` — **11** webhook/security checks.

### Application / shared code
- `apps/admin/src/middleware.ts`
- `apps/admin/src/app/api/admin/users/route.ts`
- `apps/admin/src/app/api/auth/register-user/route.ts`
- `apps/admin/src/app/login/page.tsx`
- `apps/worker/app/shift/checkin.tsx`
- `apps/worker/src/components/GeofencedCheckInModal.tsx`
- `apps/worker/app/(tabs)/earnings.tsx`
- `apps/worker/app/onboarding.tsx`
- `apps/organizer/app/shift/screening.tsx`
- `apps/organizer/app/(tabs)/finances.tsx`
- `packages/shared/src/services/offline_queue_service.ts`
- `packages/shared/src/supabase/admin.ts`
- `packages/shared/src/supabase/jobs.ts`
- `supabase/functions/dispatch-push-notifications/index.ts`

No production configuration, secrets, customer data, or provider credentials were added or changed.

---

## 5. Verification evidence

| Gate | Command | Result | Exit |
| :--- | :--- | :--- | :---: |
| Types | `npm run typecheck` | All workspaces clean | **0** |
| Unit/component | `npm test` | 32 suites, 390 tests (314 + 7 + 38 + 31) | **0** |
| Lint | `npm run lint` | All workspaces clean | **0** |
| Admin build | `CI=1 npm run build:admin` | Production build complete | **0** |
| Real DB lifecycle | `DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/opskil' npm run test:db` | **69/69 pass** | **0** |
| Full three-role workflow | `DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/opskil' node scripts/test_full_workflow_db.mjs` | **52/52 pass** | **0** |
| SQL invariants + live catalog | `DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/opskil' node scripts/test_sql_integration.mjs` | **34/34 static + live pass** | **0** |
| Static lifecycle contracts | `npm --workspace=@opskil/shared test -- lifecycle_contract_regression` | 17/17 | **0** |

The DB is a disposable PostgreSQL container populated from a Supabase-compatible bootstrap and every migration in sorted order. All fixtures are synthetic and rolled back. This is real SQL execution, not a mock, but it is **not** a production or staging environment.

---

## 6. Security and truthfulness notes

- The admin API is protected at both middleware and route level; all admin actions attribute an actor.
- Admin identity is never derived from `current_user` inside a `SECURITY DEFINER` function.
- Direct table writes cannot self-verify KYC, self-promote, change activation, edit approved pay, fund invoices, settle payouts, or forge another user’s notification (negative DB tests).
- The UI no longer displays a check-in code that the backend did not issue.
- Financial screens distinguish ledger state from actual bank settlement.
- No test was deleted or weakened to obtain a pass. One static assertion was narrowed to reject the dangerous `current_user IN ('postgres')` bypass specifically, because a safe non-bypass branch legitimately references `current_user` after checking the JWT role.

---

## 7. Residual risks

1. **P3 — `current_user` auth checks in three legacy RPCs** (`create_job_safe`, `get_organizer_applications_safe`, `sweep_expired_worker_offers_safe`). Not exploitable under current `authenticated`-only grants; becomes dangerous if granted to `anon` or if downstream checks change.
2. **P3 — `submit_review_safe` leaves `opskl.trusted='1'` for the rest of the transaction.** Transaction-local; no cross-request path found.
3. **No production/staging verification:** deployed schema, RLS, pooler/JWT behaviour, and provider webhooks are unverified.
4. **No real payment rail:** manual reconciliation only; an admin can record a settlement that has not occurred unless operations enforce bank evidence.
5. **No device/E2E run:** GPS, dialer, push, offline sync, and admin browser flows are not proven on real environments.
6. **No load/soak/penetration test.**

These are documented in `REMAINING_BLOCKERS.md`; they are not hidden behind a “100% production-ready” claim.

---

## 8. Final verdict

- **P0 remaining: 0**
- **P1 remaining: 0**
- **P2 remaining: 0**
- **P3 open: 2 (hardening only)**
- **Verdict: CONDITIONAL PILOT ONLY.**
- **Conditions:** staging schema/RLS verification, admin E2E, physical device/GPS test, a written manual-reconciliation SOP with dual control, and an explicit decision to keep payments manual (or complete the real payment rail). No unrestricted real-money production launch is approved by this audit.
