# Prioritized Improvement Plan — Opskl

> Audit date: 2026-10-21 · Commit `699a409`
> This is a **plan only**. No application, schema, RLS, auth, payment, or data changes were made.
> Ordering principle: stop active harm first, then make the core shift lifecycle executable, then make money correct, then restore user trust, then harden.
> Each batch is independently shippable and has explicit acceptance criteria.

---

## 0. Decision summary

**Do not launch.** The platform cannot complete a real shift end-to-end, has a critical authentication bypass, and presents fabricated financial data. The work below is ordered so that the first batch can be done in days and removes the worst risk, while the full remediation is a multi-week engineering program.

| Horizon | Goal | Batches |
|---|---|---|
| 0–3 days | Contain critical security and false claims | Batch 0 |
| 1–2 weeks | Make attendance/completion actually work | Batch 1 |
| 2–3 weeks | Make money correct and authorized | Batch 2 |
| 1–2 weeks | Close workflow/authz gaps | Batch 3 |
| 1–2 weeks | Remove fake data and repair UX | Batch 4 |
| Ongoing | Privacy, observability, test harness | Batch 5 |

Dependencies are strict: **Batch 1 depends on Batch 0's migration discipline** (a disposable DB and schema-contract test), and **Batch 2 depends on Batch 1** (payout needs real completed attendance).

---

## 1. P0 — stop the bleeding (Batch 0)

### P0-1. Remove the anonymous account-takeover RPC
**Evidence**: `supabase/migrations/20261015000010...:229-383`, grant `:383`.

Actions:
1. Add a migration that `REVOKE EXECUTE ... FROM anon, authenticated` and preferably `DROP FUNCTION public.register_organizer_direct_safe(TEXT,TEXT,TEXT,TEXT)`.
2. If direct registration is still needed, replace it with a server-only route that (a) requires an authenticated admin, (b) never accepts a password for an existing account, and (c) uses Supabase Auth admin APIs.
3. Audit `auth.users` for accounts whose `encrypted_password`/`updated_at` changed unexpectedly; force password resets for affected accounts.
4. Add a CI assertion: no `SECURITY DEFINER` function that writes `auth.users` is executable by `anon` or `authenticated`.

**Acceptance**
- `SELECT has_function_privilege('anon','public.register_organizer_direct_safe(text,text,text,text)','EXECUTE')` is false.
- Same for `authenticated`.
- A test proves an existing user's password cannot be changed by calling any client-exposed RPC.
- Incident review completed for accounts created/updated through the function.

**Effort**: 0.5–1 day + incident review.

---

### P0-2. Make check-in executable (or disable it)
**Evidence**: `20261020000000...:315-330` vs schema `20261012000000...:213-242`.

Actions:
1. Decide the canonical attendance schema. Recommended: keep `check_in_time`/`check_out_time`/`hours_worked` on `attendance_records` only; do not duplicate on `bookings`.
2. Rewrite `check_in_worker_safe` to:
   - insert `attendance_records(booking_id, job_id, worker_id, check_in_time, check_in_code, verified_by_supervisor, supervisor_id, notes)`;
   - update `bookings.status='checked_in'` only (no nonexistent columns);
   - use `INSERT ... ON CONFLICT` with a unique `(booking_id)` constraint (add it).
3. Add `UNIQUE(booking_id)` on `attendance_records` to prevent duplicates.
4. Store coordinates/distance in a dedicated table or columns added by migration if needed (`worker_lat`, `worker_lng`, `distance_km`) — but do not silently reference them.
5. If the fix cannot ship immediately, hide the check-in CTA and return a clear “temporarily unavailable” state rather than a generic error.

**Acceptance**
- A migration-applied test DB can call `check_in_worker_safe` for a confirmed booking and receives `success:true`.
- Exactly one attendance row exists; booking status is `checked_in`.
- Duplicate call returns a clear idempotent result, not a duplicate row.
- Invalid code/geofence/early/late cases return documented error codes.

**Effort**: 1–2 days including tests.

---

### P0-3. Make completion/sign-off executable
**Evidence**: `20261020000001...:105-130`.

Actions:
1. Remove `bookings.check_out_time`/`updated_at` writes; use `bookings.completed_at` and `status`.
2. Remove `attendance_records.status`; use `verified_by_supervisor`, `supervisor_id`, `check_out_time`, `hours_worked`.
3. Compute payable amount from verified hours × agreed hourly rate (with min/max guards) and **write `bookings.approved_total_pay`**.
4. Return the computed amount and hours in the response.
5. Add a state-machine test for `checked_in → completed`.

**Acceptance**
- Sign-off succeeds for a checked-in booking.
- `approved_total_pay` equals verified hours × rate (within rounding), and is non-null.
- Payout uses that value.
- Invalid transitions return `INVALID_TRANSITION` without partial writes.

**Effort**: 1–2 days.

---

### P0-4. Stop false success and false claims immediately
Even before deeper UX work:
1. Remove `|| true` in `apps/organizer/app/shift/screening.tsx:231,249`; only mutate/show success when `res.success`.
2. Remove or disable “✓ DISBURSED VIA UPI” (`earnings.tsx:607`) until a real settlement exists; label “Recorded — settlement pending”.
3. Disable the PDF button (`earnings.tsx:731-754`) or implement a real statement.
4. Replace “Automated disbursement” copy (`finances.tsx:581`) with the honest copy already present at `:930`.
5. Finish/commit the live roster replacement (`roster.tsx`; uncommitted work already replaces the hardcoded cards) and remove hardcoded ₹14,400 (`finances.tsx:551`).
6. Replace static SLA badges and simulated audio memo with honest states (`incident/report.tsx`).

**Acceptance**
- A forced RPC failure shows an error and does not change local state.
- No screen claims disbursement/settlement/PDF/audio/SLA that the backend cannot substantiate.
- Product/legal sign-off on all money/safety copy.

**Effort**: 1–2 days.

---

## 2. P1 — core lifecycle and workflow (Batch 1)

### P1-1. Schema-contract test harness (do this first in Batch 1)
- Add a disposable Postgres/Supabase-local CI job that applies all migrations in order.
- Introspect `information_schema.columns` and `pg_proc` and compare to a checked-in contract.
- Call each RPC with valid/invalid fixtures.
- Run the happy path: create job → offer → confirm → check-in → complete → invoice → payout.

**Acceptance**: CI fails on any unknown column, signature mismatch, or RPC error. This test alone would have caught P0-2, P0-3, S4, S10, S14.

**Effort**: 2–3 days (one-time), then minutes per run.

### P1-2. Checkout path
- Wire `check_out_worker_safe` into the worker shift screen (its SQL currently matches the schema but is unexercised).
- Allow worker checkout only after check-in and before a max shift duration.
- Supervisor sign-off remains the approval step.

**Acceptance**: worker can check out; hours are computed; supervisor sees pending approval.

### P1-3. Offer lifecycle correctness
- Add overlap check in `worker_confirm_selection_safe` (no confirmed/checked-in booking overlapping the same time window).
- Add `offer_expires_at` (or enforce `created_at + 3h`) at acceptance.
- Add a cutoff to `worker_decline_selection_safe` (e.g. no self-decline within 12h of start without a penalty flag); the function's schema references are valid but the policy is not.
- Ensure capacity is released exactly once (idempotency).

**Acceptance**: double-booking rejected; expired offer rejected; confirmed decline before cutoff works and releases capacity; tests cover each.

### P1-4. Capacity sweep scheduling and scoping
- Schedule `sweep_expired_offer_capacity_safe` via `pg_cron` (or a service-role job) every 15 minutes.
- Restrict manual execution to admin/service role; remove cross-tenant `p_job_id` abuse.
- Add metrics/alerts for swept offers.

**Acceptance**: stale offers auto-cancel; no authenticated non-admin can invoke the sweep; slot counts reconcile.

### P1-5. Dispute resolution contract
- Change client to call `(p_dispute_id, p_status, p_resolution_notes, p_booking_outcome, p_adjusted_payout)`.
- Remove `p_admin_id`; use `auth.uid()` server-side.
- Add integration test that resolves a real dispute row.

**Acceptance**: admin console can resolve/dismiss; booking status restored correctly; audit row written.

### P1-6. Admin authorization
- `is_current_admin()` must include `AND is_active = true`.
- Add session revocation on deactivation (Supabase admin sign-out or short JWT TTL).
- Gate `register-user` route behind admin auth or remove it.
- Add `ALLOW_DIRECT_*` style fail-closed checks if any minting remains.

**Acceptance**: suspended admin gets `UNAUTHORIZED` immediately; unauthenticated POST to register route returns 401/403.

### P1-7. Configuration safety
- Fail admin build/start if required env vars are missing (no placeholder fallback in production).
- Remove hardcoded sandbox webhook secret; require env.
- Replace static offline PIN with a per-user rotating code or remove the feature.

---

## 3. P1 — money correctness (Batch 2)

### P2-1. Invoice authorization and math
- Require caller = job organizer / staff / admin.
- Bill **confirmed or attended headcount**, not `slots_total`; use per-worker agreed pay and actual attendance where available.
- Freeze issued invoices; corrections via credit note, not in-place updates.
- Set `is_sandbox` from platform mode, never hardcoded true.
- Add idempotency key usage.

**Acceptance**: unauthorized call rejected; invoice total equals sum of confirmed worker pay + fee + GST; issued invoice immutable; sandbox flag reflects environment.

### P2-2. Payout authorization and amount
- Require caller = worker (self), organizer owner/staff, or admin.
- Use `approved_total_pay` only; reject if null.
- Prevent duplicate payout rows (unique booking + idempotency key).
- Do not mark `escrow_locked` unless invoice is `escrow_funded`.

**Acceptance**: unrelated user rejected; amount equals approved pay; duplicate calls idempotent; audit actor correct.

### P2-3. Fiscal sequences
- `ALTER TABLE invoice_fiscal_sequences ENABLE ROW LEVEL SECURITY`.
- Revoke INSERT/UPDATE from `authenticated`; only `service_role`/definer function mutates.
- Add a uniqueness/continuity test.

### P2-4. Real money rail or explicit manual mode
Choose one:
- **A. Integrate** Razorpay (or another provider) for order creation, webhook verification, payouts, and reconciliation; add HTTP route with HMAC verification and replay protection.
- **B. Manual pilot** clearly labeled: invoice funded by verified bank transfer, payout executed by ops, UTR recorded, worker sees “manual settlement — reference …”.

Do not claim “escrow” or “automated UPI” in either mode unless legally true.

**Acceptance**: a funded invoice and a settled payout can be traced provider-reference → invoice/payment row → worker notification; webhook signature invalid requests are rejected.

### P2-5. Webhook repair
- Fix column names to the actual schema (`paid_at`, `provider_payment_id`, `reconciliation_type`, `reference_id`, `recorded_amount`, `notes`).
- Verify HMAC before parsing; enforce idempotency via `event_id`.
- Add an HTTP endpoint only after signature verification exists.
- Restore the correct earlier implementation rather than the regressed one.

---

## 4. P2 — workflow hardening (Batch 3)

| Item | Action | Acceptance |
|---|---|---|
| Job coordinates | Require lat/lng at publish, or mark job “no geofence” and require supervisor check-in | No job can silently skip geofence |
| Supervisor proof | Separate supervisor PIN/token, hashed, per-shift, rate-limited | Blank PIN cannot fall back to worker code |
| Late check-in | Add upper bound (e.g. shift end + 2h) and late flag | Late check-in rejected/flagged |
| Client coordinates | Add device attestation or accept documented risk; do not treat as strong proof | Risk documented and tested |
| Application/booking reconciliation | Constraint or trigger keeps statuses consistent | No orphan applications/bookings |
| Incident state machine | status, assignment, escalation, SLA timestamps | Incident can be triaged and closed |
| Push function | Shared secret/HMAC + rate limit + payload validation | Forged POST rejected |
| Emergency screen | Wire to live alerts or remove; date-stamp content | No stale lockdown shown as current |
| Admin audit view | Read-only audit log viewer with filters | Admins can investigate actions |
| Admin destructive actions | Typed confirmation + reason | Accidental deletion reduced |

---

## 5. P2 — UI truthfulness and UX (Batch 4)

Ordered by user harm:

1. **Roster**: replace hardcoded cards with real `shifts`/`applications`; add honest empty state. Remove “24 APPLIED”/May 2025 fixtures.
2. **Earnings**: remove “disbursed” until settlement; implement or remove PDF; show pending/processing/settled with timestamps and references.
3. **Finances**: remove ₹14,400; compute from selected job; reconcile invoice → payment → UTR.
4. **Screening**: real success/failure; show server error; add bulk actions.
5. **Attendance**: remove fake “supervisor token” copy; show real check-in source (worker code vs supervisor override) and distance; allow undo with reason.
6. **Check-in screen**: never fall back to `bookings[0]`; show “booking not found” with back action.
7. **Onboarding**: allow profile completion without UPI, but gate *payout* on UPI; explain the difference; provide a skip that does not trap.
8. **Incident**: remove simulated audio or implement real recording; remove unsupported SLAs; show case status.
9. **My shifts**: remove “38 contenders”; fix cancellation reachability; show server-confirmed status.
10. **Emergency/offline**: remove stale content and static PIN.
11. **Admin login**: validate redirect against allowlist; add MFA.
12. **Accessibility**: pass over icon labels, dynamic type, contrast, touch targets.

**Acceptance for Batch 4**: every number on screen is either queried from the DB or explicitly labeled “demo”; every action reflects the server result; every dead-end has an exit.

---

## 6. P3 — privacy, observability, and quality (Batch 5)

- Storage bucket policy audit; signed URL expiry; KYC document access logging.
- Field-level encryption or tokenization for UPI IDs.
- Retention/deletion automation (`process_account_deletion_purge_safe` scheduled).
- Structured logging with PII redaction; error tracking (Sentry or equivalent).
- Rate limiting on auth/OTP/registration/discovery RPCs.
- Dependency and container scanning.
- Load test discovery and check-in at pilot volume.
- Backup/restore drill and migration rollback plan.
- Documentation truth pass: replace “LAUNCH READY” claims with evidence links; delete or archive contradictory reports.

---

## 7. Suggested sequencing and estimates

| Batch | Contents | Estimate | Blocks |
|---|---|---|---|
| 0 | P0-1…P0-4 containment | 3–5 days | everything |
| 1 | Test harness, check-in, completion, checkout, offers, sweep, disputes, admin auth | 2–3 weeks | money |
| 2 | Invoice, payout, fiscal seq, rail/webhook | 2–3 weeks | pilot with money |
| 3 | Workflow hardening | 1–2 weeks | scale |
| 4 | UI truthfulness/UX | 1–2 weeks | public launch |
| 5 | Privacy/observability | ongoing | scale |

**Critical path**: Batch 0 → P1-1 harness → P0-2/P0-3 fixes → Batch 2. Do not attempt a paid pilot before Batch 2 acceptance.

---

## 8. Acceptance criteria for “pilot-ready”

A real pilot should not start until all are true:

1. Anon/authenticated cannot execute any function that writes `auth.users`.
2. A disposable-DB CI job applies all migrations and executes every RPC.
3. One complete shift works: create → offer → confirm → check-in → checkout → sign-off → invoice → payout → settlement reference.
4. Geofence cannot be skipped (coordinates required or supervisor credential enforced).
5. No screen claims money movement, PDF, audio, or SLA that the backend cannot prove.
6. Suspended admins are immediately powerless.
7. Dispute resolution works end-to-end.
8. Invoice totals match confirmed/attended workers; issued invoices are immutable.
9. Payout amounts derive from verified hours and are authorized.
10. Push function rejects unsigned requests.

---

## 9. What not to do

- Do not “fix” the P0 RPCs by adding the missing columns blindly; first decide the canonical attendance model, then migrate data.
- Do not apply migrations to production without a backup and a rollback plan.
- Do not keep the `|| true` pattern “temporarily”; it hides exactly the failures you need to see.
- Do not add new features (gamification, referrals, analytics) until the core shift works.
- Do not cite the 340 passing tests as launch evidence.
- Do not operate real money under “sandbox” labels.

---

## 10. Rollback and safety notes

- Every schema change should be additive first (add columns/constraints), then switch code, then remove old paths.
- Keep `SECURITY DEFINER` functions with explicit `SET search_path` and least-privilege grants.
- Feature-flag the check-in/completion UI so it can be disabled without a deploy.
- Preserve audit logs; never delete payment/attendance rows during remediation.
- Rotate any credential that may have been exposed by the vulnerable RPC or admin routes.
