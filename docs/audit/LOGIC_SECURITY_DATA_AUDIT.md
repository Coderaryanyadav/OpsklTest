# Logic, Security & Data Audit — Opskl

> Audit date: 2026-10-21 · Commit `699a409` (+ untouched uncommitted organizer UI edits)
> Method: migration/source review, static SQL invariant checks, client–server contract comparison.
> No live database, payment provider, or OTP provider was contacted.
> Labels: **VERIFIED** / **INFERRED** / **UNKNOWN**.
> Severity: **P0** = exploitable/blocking now; **P1** = severe integrity/financial/authz defect; **P2** = significant but contained; **P3** = hardening/cleanup.

---

## 1. Executive findings

| # | Severity | Finding | Confidence |
|---|---|---|---|
| S1 | **P0** | `register_organizer_direct_safe` is granted to `anon` and rewrites any existing user's password + promotes them to organizer | VERIFIED |
| S2 | **P0** | `check_in_worker_safe` references nonexistent columns; every check-in errors | VERIFIED |
| S3 | **P0** | `complete_shift_and_approve_attendance` references nonexistent columns; completion/sign-off always errors | VERIFIED |
| S4 | **P1** | Admin dispute resolution client/server signature mismatch; unusable | VERIFIED |
| S5 | **P1** | `is_current_admin()` ignores `is_active`; suspended admins retain power | VERIFIED |
| S6 | **P1** | Invoice RPC has no authorization and over-bills unfilled slots; always sandbox | VERIFIED |
| S7 | **P1** | Payout initiation has no ownership authz and ignores verified hours | VERIFIED |
| S8 | **P1** | `invoice_fiscal_sequences` has no RLS and DML grants to `authenticated` | VERIFIED |
| S9 | **P1** | Geofence bypass when coordinates NULL; supervisor bypass; trusted client coordinates; no late bound | VERIFIED |
| S10 | **P1** | Offer accept lacks overlap/expiry checks; decline has no last-minute cutoff | VERIFIED |
| S11 | **P1** | Capacity sweep is unscheduled and callable by any authenticated user | VERIFIED |
| S12 | **P1** | Push Edge Function has no auth/shared-secret check | VERIFIED |
| S13 | **P1** | Unauthenticated admin registration route can mint pre-confirmed accounts | VERIFIED |
| S14 | **P1** | Webhook RPC (latest definition) writes nonexistent columns; no HTTP route/signature check | VERIFIED |
| S15 | **P1** | No real escrow/payout rail; "settled" is a manual DB update with arbitrary UTR | VERIFIED |
| S16 | **P1** | UI displays fabricated operational/financial data as live | VERIFIED |
| S17 | **P2** | Migration order creates later functions that regress earlier fixes (webhook, invoice funding) | VERIFIED |
| S18 | **P2** | Admin login open redirect | VERIFIED |
| S19 | **P2** | Static offline backup PIN; hardcoded sandbox webhook secret | VERIFIED |
| S20 | **P2** | RLS gaps / over-broad policies on several tables | PARTIAL |

---

## 2. P0 findings

### S1 — Anonymous account takeover via organizer registration RPC

**Evidence** — `supabase/migrations/20261015000010_fix_organizer_registration_and_role_switching.sql`:

- Function defined at `:229-383` as `SECURITY DEFINER`, owned by the migration role (superuser-equivalent).
- Existing-user branch (`:261-297`) sets:
  - `encrypted_password = extensions.crypt(p_password, gen_salt('bf'))`
  - `email_confirmed_at = COALESCE(...)`
  - raw metadata role = `organizer`
  - `profiles.role = 'organizer'`
- Grant at `:383`: `GRANT EXECUTE ... TO anon, authenticated`.

**Attack**: unauthenticated attacker calls `POST /rest/v1/rpc/register_organizer_direct_safe` with a victim's email and an attacker-chosen password. The function finds the victim in `auth.users`, resets the password, confirms the email, and promotes the account to organizer. Attacker then signs in as the victim.

**Impact**: full account takeover of any user whose email is known, including admins (role is overwritten to organizer, but access to the victim's data and organizer capabilities follows). This is a critical authentication bypass.

**Mitigating uncertainty**: `supabase/fix_permissions.sql` revokes all routines from `anon`. If it was applied *after* all migrations, the grant is gone. The repository does not record deployment order. Even then, the function remains executable by `authenticated`, so any logged-in user can reset any other user's password. The vulnerability is therefore P0 regardless of the anon grant, unless the function was dropped entirely.

**Required fix direction** (not applied): remove the function or restrict it to `service_role`; never accept a password for an existing account; use Supabase Auth admin APIs with server-side authorization; add a regression test that asserts no `anon`/`authenticated` EXECUTE grant.

---

### S2 — Check-in RPC cannot execute

**Evidence** — `supabase/migrations/20261020000000_audit_remediation_security_and_lifecycle.sql:315-330`:

```sql
UPDATE bookings
SET status='checked_in', check_in_time=v_now, updated_at=v_now
WHERE id=p_booking_id;

INSERT INTO attendance_records (
  booking_id, check_in_time, check_in_code, verified_by_supervisor,
  worker_latitude, worker_longitude, distance_to_venue_km, status
) VALUES (...);
```

Schema facts (`20261012000000_initial_schema.sql:213-242`; extensions in `20261012000003...:26-40`):

- `bookings.check_in_time` and `bookings.check_out_time` **do** exist (added by `20261012000003`), but `bookings.updated_at` does **not**.
- `attendance_records` has `latitude`, `longitude`, `distance_to_venue_km`, and `check_in_code`, but **no** `worker_latitude`, `worker_longitude`, or `status`.
- `attendance_records.job_id` and `worker_id` are `NOT NULL` and are omitted from the insert.

**Impact**: every check-in raises a Postgres error (unknown columns `worker_latitude`/`worker_longitude`/`status`, unknown `bookings.updated_at`, and NOT NULL violations on `job_id`/`worker_id`). The entire attendance pipeline is dead on arrival. Because completion requires `checked_in`, completion is also unreachable (S3).

---

### S3 — Completion/sign-off RPC cannot execute

**Evidence** — `supabase/migrations/20261020000001_manual_escrow_pilot_and_supervisor_override.sql:105-130`:

```sql
UPDATE bookings
SET status='completed', check_out_time=..., completed_at=..., updated_at=...
...
UPDATE attendance_records
SET verified_by_supervisor=true, supervisor_id=..., check_out_time=...,
    hours_worked=..., status='completed'
```

- `bookings.updated_at` does not exist (the `check_out_time` and `check_in_time` columns do exist).
- `attendance_records.status` does not exist.

**Impact**: supervisor sign-off always errors (two unknown columns); no booking can reach `completed` through this RPC; `approved_total_pay` is never written, so payout (S7) falls back to the original agreed amount.

---

## 3. P1 findings

### S4 — Dispute resolution contract mismatch
- DB: `admin_resolve_dispute_safe(p_dispute_id UUID, p_status TEXT, p_resolution_notes TEXT, p_booking_outcome TEXT DEFAULT NULL, p_adjusted_payout NUMERIC DEFAULT NULL)` — `20261015000000_launch_fixes.sql:1892-1899`.
- Client: sends `p_admin_id` and omits `p_booking_outcome` — `packages/shared/src/supabase/admin.ts:288-300`.
- The old overload was dropped in `20261015000002_function_security_and_search_paths.sql:18`.
- **Impact**: PostgREST returns “function not found” / unknown parameter. Admins cannot resolve disputes. Tests mock the RPC and assert the wrong shape (`packages/shared/src/__tests__/admin_and_trust.test.ts:172-177`), so they pass while production fails.
- **P2 sub-issue**: `p_admin_id` is caller-supplied rather than `auth.uid()`, a spoofing smell.

### S5 — Suspended admins remain admins
`is_current_admin()` (`20261012000000...:568-578`) returns true for any profile with `role='admin'`, ignoring `profiles.is_active`. Deactivation does not revoke RPC access until JWT expiry or role change.
**Impact**: compromised/offboarded admin retains full control for the token lifetime; no immediate revocation.

### S6 — Invoice generation is unauthorized and mis-bills
`generate_job_invoice_safe` (`20261015000007...:26-152`):
- No check that `auth.uid()` is the job's organizer, staff, or admin.
- `v_wage_total := v_job.total_pay * v_job.slots_total` — charges all budgeted slots even if only some were confirmed/attended.
- Existing invoice is updated in place even after issue (only `escrow_funded`/`settled` are immutable), so a caller can rewrite issued amounts.
- `is_sandbox` hardcoded `true`.
- Granted to all `authenticated`.
**Impact**: any logged-in user can generate or mutate invoices for any job; organizers can be overcharged; financial records are unreliable.

### S7 — Payout initiation lacks authorization and uses the wrong amount
`initiate_worker_payout_safe` (`20261015000000...:2540-2615`):
- Only checks `auth.uid() IS NOT NULL`.
- Accepts any `p_booking_id`; no check that caller is the worker, organizer, staff, or admin.
- `v_payout_amount := COALESCE(approved_total_pay, agreed_total_pay)`; `approved_total_pay` is never written because completion is broken.
- Writes `payment_records` and an audit row attributed to the caller.
**Impact**: any authenticated user can create/modify payout records for any completed booking; payouts ignore verified hours; financial audit trail is poisoned.

### S8 — Fiscal sequence table exposed
`invoice_fiscal_sequences` (`20261020000001...:236-242`):
- No `ENABLE ROW LEVEL SECURITY`.
- `GRANT SELECT, UPDATE, INSERT ... TO authenticated`.
**Impact**: any authenticated user can read or advance fiscal counters, causing duplicate/skipped invoice numbers and breaking statutory sequencing.

### S9 — Attendance trust model is weak
- Geofence skipped entirely when `jobs.latitude/longitude` is NULL (`20261020000000...:261`). Job creation does not guarantee coordinates.
- Worker coordinates are client-supplied; no attestation/integrity check.
- Organizer staff (`owner/admin/manager`) bypass both geofence and check-in code (`:300-315`), with no separate supervisor credential.
- Only a lower time bound (2h before start) exists; no upper bound, so check-in can occur long after the shift.
**Impact**: attendance can be marked from anywhere, by the organizer, at any time; payroll fraud is trivial.

### S10 — Offer acceptance/decline gaps
`20261021000002_worker_accept_decline_offer.sql`:
- `worker_confirm_selection_safe` checks booking/job status but **not** overlapping confirmed shifts, offer expiry, or worker availability → double-booking.
- `worker_decline_selection_safe` allows declining `confirmed` at any time pre-check-in (it reads the valid `v_booking.check_in_time`, `:161`), releasing capacity with no penalty/cutoff.
**Impact**: workers can hold multiple overlapping shifts and cancel at the last minute; organizers lose fill reliability.

### S11 — Capacity sweep
`20261021000003...:240-275`:
- Any authenticated user may call it (only requires `auth.uid()`), with no organizer/admin scoping and optional `p_job_id`.
- Not scheduled via `pg_cron` and not called by any app code (only tests reference it).
**Impact**: stale offers keep slots filled; any user can trigger cross-tenant capacity mutations.

### S12 — Push function unauthenticated
`supabase/functions/dispatch-push-notifications/index.ts:29-56`:
- No `Authorization`/shared-secret check, no webhook signature.
- Accepts arbitrary JSON `{type:'INSERT', record:{user_id,title,body,...}}` and sends via Expo using the service-role client.
**Impact**: anyone who knows the function URL can send arbitrary push notifications to any user, enabling phishing/social engineering. Also a spam amplifier.

### S13 — Unauthenticated account minting route
`apps/admin/src/app/api/auth/register-user/route.ts`:
- No admin session check.
- Uses `SUPABASE_SERVICE_ROLE_KEY` to `auth.admin.createUser({ email_confirm: true })`.
- `role` is constrained to worker/organizer, but accounts are pre-confirmed and profiles created.
**Impact**: anyone who can reach the admin deployment can create unlimited confirmed accounts, bypassing OTP/email verification and anti-abuse controls. (The organizer variant is fail-closed behind `ALLOW_DIRECT_ORGANIZER_REGISTRATION=true` and rejects existing accounts — **VERIFIED**; the user variant has no gate.)

### S14 — Webhook processing broken and unwired
- Latest `process_payment_webhook_safe` is defined in `20261015000003_security_and_privacy_hardening.sql:17-133` (filename sorts after `20261015000000`, so it overrides the correct earlier version).
- It writes `organizer_invoices.escrow_funded_at` and `payment_reference` — neither column exists (schema has `paid_at`, `provider_payment_id`).
- It writes `payment_reconciliation_logs(invoice_id, event_type, received_amount, metadata)` — none exist (schema uses `reconciliation_type`, `reference_id`, `recorded_amount`, `notes`).
- Only `service_role` may execute, but there is no HTTP route or signature verification in the repo.
**Impact**: any webhook integration will fail at runtime; escrow funding cannot be automated; if a route is added naively, it would be forgeable.

### S15 — No real money movement
- No provider call in `initiate_worker_payout_safe`; it only writes `payment_records`.
- Admin settlement sets `status='settled'`, `utr_reference=p_utr` with no validation/reconciliation (`admin_mark_payout_settled`).
- Razorpay provider code exists (`packages/shared/src/payments/razorpay-provider.ts`) but is not wired to any route.
- Invoice funding is manual reference entry.
**Impact**: “escrow”, “disbursed”, and “settled” are database labels. There is no regulated escrow/nodal account integration in this repository. Operating as if there were creates legal/financial risk.

### S16 — Fabricated operational data
See `UI_UX_AUDIT.md` §6 for the full inventory. Security/data relevance:
- At `HEAD`, fake roster shifts/applicant counts (`roster.tsx`); the active uncommitted work replaces them with live data (not committed/tested).
- “Disbursed via UPI” without disbursement (`earnings.tsx`).
- False success on screening failures (`screening.tsx`).
- Simulated audio evidence and SLAs (`incident/report.tsx`).
- Hardcoded ₹14,400 wage pool (`finances.tsx:551`).
**Impact**: decisions are made on false data; audit trails disagree with what users were told.

---

## 4. P2 / P3 findings

| ID | Finding | Evidence | Impact | Severity |
|---|---|---|---|---|
| P2-1 | Migration ordering regressions | `20261015000003` overrides `20261015000000` webhook; `20261015000003` invoice funding references missing columns before being fixed later | fixes silently reverted depending on order | P2 |
| P2-2 | Admin login open redirect | `apps/admin/src/app/login/page.tsx:70-72` uses `redirect` directly | phishing post-login | P2 |
| P2-3 | Static offline PIN | `packages/shared/src/services/offline_queue_service.ts:196-198` | no security value; false assurance | P2 |
| P2-4 | Hardcoded sandbox webhook secret | `packages/shared/src/payments/sandbox-provider.ts:30` default `'opskil_sandbox_webhook_secret_2026'` | forgeable sandbox events if used in staging | P2 |
| P2-5 | Broad RLS on organizer memberships | `20261012000000...:684` `organizer_id = auth.uid()` assumes membership id = user id | team members may be locked out or mis-scoped | P2 (INFERRED) |
| P2-6 | `audit_logs` write-only for clients | only SELECT policy for admins; RPC writes via definer | no tamper-evident trail from client, but no append-only guarantee at DB level | P2 |
| P2-7 | No rate limiting on RPCs | auth/OTP/registration RPCs have no throttling | abuse/spam | P2 |
| P2-8 | Error leakage | admin APIs return raw Supabase `error.message` | schema/provider disclosure | P2 |
| P2-9 | `.env` names only | no secrets committed (`git ls-files` check) | good; but deployment config unknown | P3 |
| P2-10 | Demo fixture flag unused | `EXPO_PUBLIC_USE_DEMO_FIXTURES` referenced by zero files | cannot disable demo data in production | P2 |

---

## 5. RLS and grant review

### 5.1 Verified controls
- RLS enabled on core tables (`20261012000000...:540-565`).
- `audit_logs` readable only by admins (`:809-812`).
- `anon` has table access revoked by `supabase/fix_permissions.sql` (if applied).
- Several RPCs `REVOKE ... FROM PUBLIC, anon` and grant only `authenticated`.

### 5.2 Verified gaps / risks

| Table / function | Issue | Evidence |
|---|---|---|
| `invoice_fiscal_sequences` | no RLS + DML to authenticated | `20261020000001...:236-242` |
| `register_organizer_direct_safe` | executable by `anon` and `authenticated`; password reset | `20261015000010...:383` |
| `is_current_admin()` | ignores `is_active` | `20261012000000...:568-578` |
| `generate_job_invoice_safe` | executable by any authenticated; no ownership check | `20261015000007...:151-152` |
| `initiate_worker_payout_safe` | any authenticated; no ownership check | `20261015000000...:2540-2560` |
| `sweep_expired_offer_capacity_safe` | any authenticated; cross-tenant | `20261021000003...:246-261` |
| `admin_mark_payout_settled` | granted to all `authenticated`, but internally requires `is_current_admin()`; suspension gap applies | `20261015000000...:2617-2674` |
| `dispatch-push-notifications` | no auth | Edge Function |
| `process_payment_webhook_safe` | service_role only, but broken schema | `20261015000003...:17,133` |

**UNKNOWN** — Actual grants in the deployed database. Migrations and `full_schema_release.sql` are the only evidence. If `fix_permissions.sql` ran last, some anon grants are revoked, but authenticated grants remain.

### 5.3 Column-level integrity
- `check_worker_profile_update` / `prevent_role_escalation` triggers block direct role and verification changes by non-admins (`20261012000000...:815+`, `20261017000000...`).
- `handle_new_user_provisioning` originally mapped client metadata `role='admin'` to admin (`20261015000010...:20-23`), but `20261020000000...:17-70` removes that mapping. **Current head is safe; historical migration window was not.** This is a reminder that migration replay order matters.

---

## 6. Financial logic review

### 6.1 Calculation layer
`packages/shared/src/payments/calculator.ts` and organizer tests implement:
- wage pool = headcount × wage,
- platform fee = wage pool × fee %,
- GST = platform fee × GST %,
- organizer total = wage pool + fee + GST,
- worker net = wage (no fee deduction).

Unit tests assert these numbers (e.g. `apps/organizer/__tests__/organizer_management.test.ts:280-289`). The math is internally consistent. **VERIFIED.**

### 6.2 Persistence layer diverges
- Invoice uses `jobs.total_pay * jobs.slots_total` (budgeted, not attended).
- Payout uses `approved_total_pay` (never written) → `agreed_total_pay`.
- No double-entry ledger; no idempotency key enforcement at the provider boundary (invoice has `idempotency_key` but no provider call).
- `is_sandbox=true` always, even when a real reference is submitted.

### 6.3 Reconciliation
- Manual reference submission stores `provider_payment_id` on the invoice and a reconciliation row (latest `20261020000001` version).
- Webhook path (broken) would update status if amount equals total.
- Admin settlement accepts any non-empty UTR; no check against provider records.

**Conclusion**: financial state is a set of optimistic labels with no external verification. Treat as prototype-grade.

---

## 7. Privacy and data protection

**VERIFIED**
- Phone numbers, KYC document references, UPI IDs, and location coordinates are stored.
- KYC documents are uploaded to Supabase Storage; path construction is in the onboarding/verification screens.
- No encryption-at-rest controls beyond Supabase defaults; no field-level encryption for UPI/KYC.
- `profiles.email` is unique; organizer views may expose worker contact details depending on RLS (INFERRED).
- No data-retention job is scheduled; `process_account_deletion_purge_safe` exists but is not scheduled/called (INFERRED from search).
- Incident evidence (photos) is stored; audio is not actually captured.

**UNKNOWN**
- Storage bucket policies and signed-URL expiry.
- Whether KYC documents are visible to other workers/organizers.
- Actual PII access logs.

**Recommendation**: treat as P1 privacy work before any real-user launch: bucket policy audit, least-privilege views, field encryption for UPI, retention/deletion automation, and access logging.

---

## 8. Secrets and configuration

**VERIFIED**
- `.env*` files are gitignored; no secret values were printed.
- Required names include `SUPABASE_SERVICE_ROLE_KEY`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `EXPO_ACCESS_TOKEN`, SMTP/Resend keys.
- `ALLOW_DIRECT_ORGANIZER_REGISTRATION` gates the organizer minting route (fail-closed by default).
- Sandbox provider has a hardcoded default webhook secret (P2).
- Admin build succeeds with placeholder env, meaning missing env is not caught at build time.

**UNKNOWN**
- Whether service-role keys are exposed to any client bundle. Static inspection found service-role usage only in server routes/Edge Function, but no bundle audit was run.
- Supabase dashboard configuration (redirect URLs, OTP limits, webhooks, cron).

---

## 9. Test-vs-reality gap

340 unit tests pass, yet S1–S16 exist. Reasons:

1. Tests mock `supabase.rpc()` and assert call arguments, not SQL behavior.
2. No test executes migrations against a Postgres instance in CI.
3. No test asserts column existence or RPC signatures.
4. The SQL “integration” script has a static phase (26 invariants) but its live phase was not run; it does not validate RPC execution.
5. UI tests assert rendered strings, not server outcomes (and `|| true` makes failure invisible).

**Recommendation**: add a disposable Postgres (or Supabase local) job that applies all migrations and runs a smoke test for every RPC. This single change would have caught S2, S3, S4, S10, S14.

---

## 10. Prioritized remediation (security)

**Immediate (P0)**
1. Revoke/drop `register_organizer_direct_safe`; rotate credentials for any account created through it; audit `auth.users.updated_at` anomalies.
2. Fix or disable check-in/completion RPCs; do not ship an attendance UI until the schema contract matches.
3. Add a migration test that fails on unknown columns.

**Next (P1)**
4. Fix dispute RPC contract; derive admin from `auth.uid()`.
5. Add `is_active` to `is_current_admin()`.
6. Add ownership/staff checks to invoice and payout RPCs; compute from attendance.
7. Enable RLS on `invoice_fiscal_sequences`; revoke DML.
8. Require supervisor credential + server-side geofence policy; reject NULL-coordinate jobs or mark them unverifiable.
9. Add overlap/expiry/cutoff rules to offers.
10. Schedule capacity sweep; restrict to admin/service role.
11. Authenticate the push function (shared secret/HMAC).
12. Gate `register-user` behind admin auth or remove it.
13. Fix webhook schema and add signature verification + HTTP route.
14. Commit the live roster work; replace remaining fake financial data or label it demo.

**Then (P2)**
15. Fix open redirect, static PIN, sandbox secret, error leakage.
16. Add rate limits and audit-log append-only protections.
17. Add retention/deletion automation and storage policy review.

---

## 11. What remains unknown

- Deployed schema/grants vs. repository migrations.
- Whether `fix_permissions.sql` was applied last.
- Whether any real accounts were created through the vulnerable RPC.
- Whether the push function is deployed publicly and whether a webhook secret is configured.
- Actual Razorpay account mode and whether any live money moved.
- Storage bucket policies and KYC document exposure.
- Runtime behavior of RLS under real JWT claims (no live DB test).
