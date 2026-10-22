# Opskl Root-Cause Analysis

**Date:** 22 October 2026  
**Purpose:** Explain the systemic causes behind the P0/P1 defects in `BUG_LEDGER.md`, not just the individual patches. Every root cause below was reproduced on a disposable PostgreSQL database and/or by source inspection.

---

## 1. RCA-001 [P0] Schema drift: RPCs were written against a different database than the migrations created

### Evidence
A fresh database built from all `supabase/migrations/*.sql` files lacked `bookings.created_at`, `bookings.updated_at`, `payment_records.updated_at`, and `disputes.assigned_to` / `disputes.updated_at`. The lifecycle RPCs updated those columns and failed with `SQLSTATE 42703`.

### Five whys
1. **Why did confirmation/check-in/completion fail?** The SQL referenced columns absent from the actual table.
2. **Why were the columns absent?** Migrations were added incrementally, and later RPC migrations assumed an audit-column convention that earlier table definitions never applied.
3. **Why did unit tests not catch it?** The shared tests mocked the Supabase client / RPC responses. A mocked `rpc()` returns success even if the real SQL would not compile.
4. **Why was there no database contract test?** The test strategy treated SQL as configuration rather than executable code; there was no CI step that replayed migrations into an empty database and invoked each lifecycle RPC.
5. **Why did the drift persist?** Corrective migrations were additive, but no one owned a canonical schema snapshot or a “fresh install” gate.

### Corrective architecture
- Added idempotent corrective migrations rather than editing already-applied history.
- Added `scripts/test_lifecycle_db.mjs`, which rebuilds a disposable database, applies every migration, and executes the full lifecycle through the real RPCs.
- Added source-contract tests that assert the final SQL text contains the required columns/overloads, as a fast pre-check.

### Prevention
- CI must run a fresh-database migration replay and the lifecycle suite on every migration change.
- No RPC may be merged without at least one executable test against the canonical schema.
- Keep a schema snapshot / generated types artifact in the repo and diff it in review.

---

## 2. RCA-002 [P0] `SECURITY DEFINER` identity confusion: `current_user` is not the caller

### Evidence
`is_current_admin()` and three profile-protection trigger functions used:

```sql
current_user IN ('postgres', 'service_role', 'supabase_admin')
```

Because the functions are `SECURITY DEFINER`, `current_user` is the function owner (`postgres`), not the JWT caller. Therefore:
- `is_current_admin()` returned true for every authenticated user.
- The role-escalation and KYC triggers never blocked direct table updates.
- A worker could run `UPDATE profiles SET role='admin'` and `UPDATE worker_profiles SET verification_status='verified'`.

### Five whys
1. **Why did every caller look like postgres?** `SECURITY DEFINER` changes the execution role to the owner.
2. **Why was `current_user` used?** It was intended as a “trusted internal maintenance” shortcut, but its semantics were misunderstood.
3. **Why did tests miss it?** Tests invoked helper functions directly as the test role and never exercised the trigger through a PostgREST-like `SET ROLE authenticated` session with a JWT.
4. **Why was there no negative authorization test?** Security tests asserted happy-path success, not “worker must be denied”.
5. **Why did the pattern spread?** It was copied between admin checks, profile triggers, and legacy RPCs.

### Corrective architecture
- Admin identity is derived from the verified JWT and `profiles.role='admin' AND is_active=true`, never from the execution role.
- Maintenance bypass uses `session_user` (the original connection role), not `current_user`.
- Service-role requests are explicitly detected via `auth.role()` / JWT claim.
- Internal derived-field updates use a short-lived, transaction-local `opskl.trusted` flag that is reset immediately after the update.
- Added DB negative tests with a dedicated unprivileged `opskil_api` role, `SET SESSION AUTHORIZATION`, `SET ROLE authenticated`, and JWT claims, mirroring the real API path.

### Prevention
- Ban `current_user` in authorization logic. Use `auth.uid()` / `auth.role()` / `session_user` with a documented rationale.
- Every trigger and admin RPC needs a negative test that proves a non-admin is denied.
- Add a static grep gate for `current_user` in `SECURITY DEFINER` functions and require review of any exception.

---

## 3. RCA-003 [P0] RPC contract drift: stale columns, ambiguous overloads, invalid enum literals

### Evidence
- `check_in_worker_safe` referenced non-existent attendance columns and omitted required identifiers.
- `complete_shift_and_approve_attendance` existed as both a 2-argument and 4-argument overload.
- `worker_confirm_selection_safe` compared `jobs.status` to `'closed'`, which is not a member of the `shift_status` enum.
- `admin_resolve_dispute_safe` expected `p_booking_outcome`, but the client sent `p_admin_id`.

### Five whys
1. **Why did the RPCs fail or resolve unpredictably?** The SQL text and the TypeScript call sites evolved independently.
2. **Why were there two overloads?** A corrective migration added a new signature but did not drop the old one.
3. **Why was the enum literal invalid?** It was written from memory rather than against the enum definition; PostgreSQL only validates it at execution time.
4. **Why did the client send the wrong argument?** RPC parameters are weakly typed at the TypeScript boundary; there is no generated database type or contract test.
5. **Why no compile-time failure?** PostgreSQL compiles PL/pgSQL bodies lazily; some errors only appear when the branch executes.

### Corrective architecture
- Dropped the obsolete overload and recreated a single canonical signature.
- Corrected the call site to `p_booking_outcome`.
- Replaced the invalid literal with real terminal states.
- Added executable tests that hit each branch (idempotent re-confirmation, non-owner completion, non-admin dispute resolution).
- Static source-contract tests guard the overload removal and enum literal.

### Prevention
- Generate TypeScript types from the database and use them for RPC arguments.
- Add a migration linter that checks enum literals, function signatures, and overload uniqueness.
- Require an executable test for every `CREATE OR REPLACE FUNCTION` that changes a branch.

---

## 4. RCA-004 [P1] Financial state machines lacked invariants

### Evidence
- `admin_mark_payout_settled` could settle any status, overwrite a previous UTR, and accept an empty reference.
- `invoice_fiscal_sequences` was client-writable.
- `generate_invoice_number()` was executable by `authenticated`/`anon`.
- `submit_invoice_payment_reference_safe` was executable by `anon` via `PUBLIC`.
- Direct client updates to `payment_records` / `organizer_invoices` were blocked by RLS only because of missing policies; there was no explicit test.

### Five whys
1. **Why could a payout be settled twice?** The function performed an unconditional update.
2. **Why was there no state check?** The admin was trusted to “do the right thing”, and the function was treated as a thin wrapper rather than a state machine.
3. **Why was the sequence client-writable?** RLS/grants were applied to user-facing tables but missed an internal allocator table.
4. **Why were function grants too broad?** PostgreSQL grants `EXECUTE` to `PUBLIC` by default; the migration revoked table DML but not function execution.
5. **Why no financial invariant tests?** Tests covered only the happy path and did not assert failed/refunded/double-settlement behaviour.

### Corrective architecture
- Payout settlement now requires `escrow_locked` or `processing`; same UTR is idempotent; a different UTR is rejected pending a separate reversal workflow; UTR length is validated.
- Fiscal sequence RLS enabled and client DML revoked.
- Internal allocator execute granted only to `service_role`.
- UTR submission restricted to `authenticated` and `service_role`.
- Added negative DB tests for direct invoice/payout tampering and function grants.

### Prevention
- Explicitly revoke `PUBLIC`/`anon` on every new function and grant the minimum role.
- Every money-moving RPC must define allowed source states, idempotency key, amount derivation, and audit/reconciliation records.
- Add a “financial invariants” suite that runs state transitions in both directions and asserts rejected transitions.

---

## 5. RCA-005 [P1] Truthfulness failures: fabricated UI state and optimistic success

### Evidence
- Static check-in pass `8842JW` / `884219`, a fake rotating-token timer, and an `OP-xxxx` mapper that could display a code never issued by the server.
- Screening used `res.success || true`, showing success even when the mutation failed.
- Worker earnings displayed “DISBURSED VIA UPI” and a no-op PDF export.
- Organizer finances displayed a hardcoded ₹14,400 pool and implied automated disbursement.

### Five whys
1. **Why did the UI show data that did not exist?** Placeholder/demo values were left in production paths.
2. **Why did failure look like success?** A defensive `|| true` was used to avoid crashing the screen, instead of handling the error.
3. **Why did financial copy overstate reality?** The UI was written for an intended payment rail that was never integrated.
4. **Why did tests not catch it?** Tests asserted that screens render, not that displayed claims match backend state.
5. **Why was there no product-truth review?** The audit treated compile/test success as correctness, not truthfulness.

### Corrective architecture
- Check-in UI displays only a server-issued code; if none exists, it says so.
- Screening surfaces real errors and never optimistically claims success.
- Earnings say “SETTLED — MANUAL RECONCILIATION”; PDF export explicitly reports it is unavailable.
- Finances derive values from the ledger and state that bank escrow/disbursement is not integrated.
- Source-contract tests assert the absence of the old fabricated strings and the presence of truthful copy.

### Prevention
- Treat user-visible financial/security claims as testable contracts.
- No placeholder identifiers in production components.
- Every mutation result must be branched on `success === true`, with an error path.

---

## 6. RCA-006 [P1] PostgreSQL regex portability: repetition bounds

### Evidence
`{2,256}` in the UPI validator raised `invalid regular expression: invalid repetition count(s)` because PostgreSQL’s regex engine caps repetition counts at 255. Every valid UPI save failed, including the trigger path.

### Five whys
1. **Why did a valid UPI fail?** The regex could not compile.
2. **Why was the bound 256?** It was chosen as “long enough” without checking PostgreSQL’s limit.
3. **Why was it not caught?** The validation was only exercised through a mock or not exercised at all.
4. **Why did it appear in multiple migrations?** The same regex was copied into newer trigger rewrites.
5. **Why no execution test for validation?** The test strategy did not include a real database write with a valid UPI.

### Corrective architecture
- Uses `{2,255}`.
- Added a DB check that a worker can update a valid UPI handle through the real trigger.
- Keep validation in one shared SQL helper where possible to avoid copy drift.

### Prevention
- Prefer simple, bounded patterns or application-level validation plus a database constraint.
- Add executable tests for every validation regex with valid and invalid samples.

---

## 7. RCA-007 [P1] Open redirect at the admin login boundary

### Evidence
`/login?redirect=https://evil.example` and protocol-relative URLs were accepted after authentication.

### Root cause
The redirect target was passed to `window.location.href` without same-origin validation. The code trusted a query parameter.

### Corrective architecture
Only same-origin absolute paths are accepted: must start with `/`, must not start with `//`, and must not be protocol-relative. Source-contract test asserts the guard.

### Prevention
Centralize post-login navigation in a helper that validates origin; never pass raw query parameters to navigation APIs.

---

## 8. RCA-008 [Process] The test strategy created false confidence

The recurring meta-cause is that the previous suite proved **code paths were reachable**, not that **the deployed schema and authorization model were correct**.

Contributing factors:
- Supabase client mocks returned success for RPCs that would fail in PostgreSQL.
- Tests ran as a superuser/test role, so RLS and `SECURITY DEFINER` semantics were not exercised.
- Static tests searched source text but did not execute migrations.
- No negative tests for “worker must be denied”, “failed state must not settle”, or “invalid UPI must not corrupt a profile”.
- Prior audit documents counted findings from one phase and understated later database findings.

Corrective architecture:
- Fresh disposable PostgreSQL replay of all migrations.
- Real RPC execution with JWT-like claims and `SET ROLE` / `SET SESSION AUTHORIZATION`.
- Negative RLS/trigger tests.
- Static contract tests as a fast guard, not a substitute for execution.
- Independent re-audit of the final tree and final verification run.

Residual process risk:
- No production/staging environment was available, so deployed migration state and provider integrations remain unverified.
- Admin Playwright E2E and mobile simulator/device tests were not run.
- The two P3 hardening items in `BUG_LEDGER.md` remain open.

---

## 9. RCA-009 [P1] Security hardening was tested only negatively, so it over-blocked trusted RPCs

### Evidence
After the privilege-escalation fix, a direct `UPDATE profiles SET role='admin'` was correctly rejected. However, the legitimate `switch_user_role_safe('organizer', ...)` call used by organizer login was also rejected with `Unauthorized: Users cannot change their assigned role.` The same applied to the explicit role-switch branch of `ensure_user_profile_provisioned_safe`.

### Five whys
1. **Why did organizer login fail?** The role-escalation trigger rejected every role change from a JWT-authenticated session.
2. **Why did the trigger reject an authorized RPC?** The trigger had no mechanism to distinguish a trusted `SECURITY DEFINER` role-management RPC from a direct client `UPDATE`.
3. **Why was that distinction missing?** The hardening work focused on closing the escalation path and did not enumerate the legitimate writers of `profiles.role`.
4. **Why did tests not catch it?** Tests asserted the negative case (“worker cannot become admin”) but had no positive case for “authorized worker→organizer switch succeeds”.
5. **Why was there no positive authorization test?** The test strategy treated authorization as a denial-only concern; it did not model the product’s legitimate role transitions.

### Corrective architecture
- `switch_user_role_safe` and `ensure_user_profile_provisioned_safe` set a narrowly-scoped, transaction-local `opskl.role_switch` flag only around their own role update.
- `prevent_role_escalation` permits that window and still rejects direct client role changes, including `worker -> admin`.
- The full-workflow DB test covers switch → organizer subprofile → switch back → direct-update denial.
- A static contract test guards the migration’s trusted-window structure.

### Prevention
- Every authorization guard needs both a negative test and a positive test for each legitimate writer.
- Enumerate the trusted writers of privileged columns (role, verification, activation, financial state) and require an executable test for each.
- Prefer a dedicated trusted-context flag over broad “authenticated” exceptions.

---

## 10. Summary of systemic corrections

| Root cause | Correction | Proof |
| :--- | :--- | :--- |
| Schema drift | Idempotent corrective migrations + fresh-DB replay | 69/69 DB checks |
| `SECURITY DEFINER` identity confusion | JWT/session identity, no `current_user` auth | RLS/trigger negative checks |
| RPC contract drift | Single canonical signatures + executable branch tests | Lifecycle DB suite |
| Financial state gaps | State guards, idempotency, minimum grants | Payout/sequence checks |
| Truthfulness failures | Remove fabricated values, truthful copy | Source-contract tests |
| Regex portability | `{2,255}` + valid-UPI DB test | UPI update check |
| Open redirect | Same-origin path validation | Contract test |
| Over-broad role guard | Trusted RPC window + positive switch test | 52-check workflow |
| Weak test strategy | Fresh DB + negative + static layers | Full verification matrix |
