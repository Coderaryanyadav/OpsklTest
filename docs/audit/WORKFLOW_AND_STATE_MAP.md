# Workflow and State Map — Opskl

> Audit date: 2026-10-21 · Commit `699a409` (+ uncommitted organizer UI edits, untouched)
> Labels: **VERIFIED** / **INFERRED** / **UNKNOWN**
> This document traces each lifecycle as implemented, not as described in marketing docs. Red flags mark transitions that cannot succeed or that bypass required controls.

---

## 1. State vocabulary (as implemented)

**VERIFIED** — enums in `supabase/migrations/20261012000000_initial_schema.sql` and later alterations.

### `job_status`
`draft → open → filling → filled → in_progress → completed` plus `cancelled`.

### `application_status`
`applied`, `shortlisted`, `confirmed`, `rejected`, `withdrawn`; `20261021000001_select_worker_offer_lifecycle.sql` adds `selected_awaiting_confirmation`.

### `bookings.status` (TEXT + CHECK)
Constraint replaced in `20261012000003_booking_attendance_engine.sql:7-22` to:

`selected_awaiting_confirmation`, `confirmed`, `checked_in`, `checked_out`, `completed_awaiting_review`, `completed`, `cancelled`, `no_show`, `disputed`.

### `payout_status`
`pending`, `escrow_locked`, `processing`, `settled`, `failed`, `refunded`.

### `attendance_records`
No status column. Fields: `check_in_time`, `check_out_time`, `hours_worked`, `verified_by_supervisor`, `supervisor_id`, `notes`.

### `organizer_invoices.status`
Draft/issued/escrow-funded/settled variants (see `20261015000007...` and `20261020000001...`).

---

## 2. End-to-end intended flow

```
Worker signup → KYC → discover/apply ─┐
                                      ├→ organizer screens → offer/confirm → booking
Organizer signup → verify → post job ─┘

booking(selected_awaiting_confirmation)
   ├─ worker confirms → confirmed
   └─ worker declines / expiry → cancelled (capacity released)

confirmed → check_in (geofence + code) → checked_in
checked_in → supervisor sign-off → completed
checked_in → worker checkout → checked_out → completed_awaiting_review → completed

completed → invoice funded → payout initiated → settled (manual UTR today)

any state → dispute → admin resolution → restored/cancelled/refunded
```

Each arrow below is annotated with the implementing RPC and its actual behavior.

---

## 3. Job lifecycle

| Transition | Implemented by | Evidence | Status |
|---|---|---|---|
| create draft/open | `create_job_safe` | `20261015000012_robust_create_job_safe.sql`, `20261017000001_shift_creation_and_rpc_hardening.sql` | VERIFIED path exists |
| open → filling | `slots_filled > 0` after offers | `20261021000001...:117-140` | VERIFIED |
| filling → filled | `slots_filled >= slots_total` | `20261021000002...:91-99` | VERIFIED |
| filled → open/filling | decline/cancel releases capacity | `20261021000002...:181-195` | VERIFIED (but decline RPC may error first — §6) |
| any → cancelled | organizer cancellation RPC | `20261015000000_launch_fixes.sql:700-730` | VERIFIED |
| stale offers release capacity | capacity sweep | `20261021000003...:246-261` | ⚠️ exists but never scheduled/called from app |

**Gap J1 — P1: capacity sweep is not scheduled.** `sweep_expired_offer_capacity_safe` exists, is executable by any authenticated user, and is only referenced by tests. No `pg_cron` schedule, no client call. Result: declined/abandoned offers can leave `slots_filled` elevated indefinitely, hiding real openings.

**Gap J2 — P2: job status is not enforced at check-in.** `check_in_worker_safe` never checks `v_job.status`; a cancelled/completed job's booking could still be checked in if the booking row is in a valid state (in practice booking would be cancelled too, but no invariant enforces it).

**Gap J3 — P1: `jobs` coordinates can be NULL.** When `latitude`/`longitude` are NULL the geofence block in `check_in_worker_safe:261-300` is skipped entirely for workers. Any job created without coordinates becomes check-in-from-anywhere. Organizer `create` form does not require coordinates (INFERRED from field validation).

---

## 4. Application → offer → booking

### 4.1 Worker applies
`apply_to_job_safe` (KYC-gated by `20261015000005_enforce_kyc_on_application.sql`) inserts `job_applications`. **VERIFIED.**

### 4.2 Organizer sends offer
`select_worker_for_job_safe` (`20261021000001...`) creates a booking in `selected_awaiting_confirmation` and holds a slot by incrementing `slots_filled`. **VERIFIED.**

**Gap O1 — P1: no overlap check.** A worker already confirmed for an overlapping shift can be offered/confirmed for another. `worker_confirm_selection_safe` checks only booking status and job status, not time overlap or existing confirmed bookings (`20261021000002...:26-105`). Double-booking is possible and later breaks attendance/payout expectations.

**Gap O2 — P1: offer expiry is unenforced at acceptance.** There is no `offer_expires_at` check in `worker_confirm_selection_safe`. The sweep may cancel stale offers eventually, but a worker can accept an arbitrarily old offer if the sweep has not run. The 3-hour window exists only in the sweep's `WHERE` clause (`20261021000003...:255-270`).

**Gap O3 — P1: decline of a confirmed booking has no cutoff.** `worker_decline_selection_safe` allows declining a `confirmed` booking any time before check-in, releasing capacity with no penalty/cutoff. A worker can hold a slot until the last moment.

**Gap O4 — P1: decline has no meaningful cutoff.** `worker_decline_selection_safe` reads `v_booking.check_in_time` (`20261021000002...:161`); that column does exist on `bookings` (added in `20261012000003...:26-33`), so the function can execute. The policy problem remains: a `confirmed` worker can decline at any time before check-in (no 12h/24h cutoff, no penalty flag), releasing capacity at the last minute. The only guard is “not already checked in.”

**Gap O5 — P2: cancel/decline side effects rely on check-in columns that do not exist.** Same class of defect appears in `check_in_worker_safe` and `complete_shift_and_approve_attendance` (§5, §6).

### 4.3 Booking data integrity

**VERIFIED** — `bookings` has `UNIQUE(job_id, worker_id)`, so duplicate booking rows for the same pair are prevented.

**Gap O6 — P2: `job_applications` and `bookings` can disagree.** Offer creation updates applications to `selected_awaiting_confirmation`; confirmation updates to `confirmed`; decline sets `withdrawn`. But no constraint ties the two, and the capacity sweep updates bookings without necessarily reconciling applications.

---

## 5. Check-in / attendance

| Transition | RPC / surface | Evidence | Status |
|---|---|---|---|
| confirmed → checked_in | `check_in_worker_safe` | `20261020000000...:149-345` | ❌ **always errors** |
| worker checkout | `check_out_worker_safe` | `20261015000000...:1680-1745` | ✅ SQL path valid (`bookings.check_out_time` exists) but **no UI action** |
| supervisor sign-off → completed | `complete_shift_and_approve_attendance` | `20261020000001...:52-146` | ❌ **always errors** (`bookings.updated_at`, `attendance_records.status`) |
| auto-complete stale | `auto_complete_stale_bookings` | `20261015000000...:780-800` | ⚠️ SQL valid; not scheduled/called, so never runs |

### P0 — `check_in_worker_safe` cannot succeed
`20261020000000_audit_remediation_security_and_lifecycle.sql:315-330`:

- `UPDATE bookings SET status='checked_in', check_in_time=v_now, updated_at=v_now` — `check_in_time` **does** exist (added in `20261012000003...:26-33`), but `bookings.updated_at` does **not** (initial table `20261012000000...:213-226`; later `ALTER TABLE bookings` only adds `status_before_dispute` and `approved_total_pay`).
- `INSERT INTO attendance_records (..., worker_latitude, worker_longitude, distance_to_venue_km, status)` — the real location columns are `latitude`, `longitude`, `distance_to_venue_km` (`20261012000003...:36-40`). `worker_latitude`, `worker_longitude`, and `status` do **not** exist; the insert also omits NOT NULL `job_id` and `worker_id`.

**Impact:** every worker/supervisor check-in returns a database error. The worker check-in UI shows a failure; no attendance row is created; the booking never enters `checked_in`.

### P0 — `complete_shift_and_approve_attendance` cannot succeed
`20261020000001...:105-130`:

- `UPDATE bookings SET check_out_time=..., updated_at=...` — `check_out_time` **does** exist (`20261012000003...:26-33`); `bookings.updated_at` does **not**.
- `UPDATE attendance_records SET status='completed'` — `attendance_records` has no `status` column.
- It also stops writing `approved_total_pay` even though it computes `v_effective_hours`. Later payout logic reads `approved_total_pay` (`20261015000000...:2585`), so even if the update succeeded, pay would be based on the original agreed amount rather than verified hours.

**Impact:** supervisor sign-off and completion always fail; no path from `checked_in` to `completed` exists through the UI/RPC.

### Gap A1 — P1: geofence is self-reported and bypassable
- Worker coordinates come from the device (`p_lat`, `p_lng`) and are trusted by the server; a modified client can send venue coordinates.
- If job coordinates are NULL, geofence is skipped entirely (`:261`).
- Supervisors bypass geofence and check-in code by design (`:300-315`), but the same RPC also lets any organizer team member with role `owner/admin/manager` check a worker in without any code. No PIN/credential is required from the supervisor; the client pre-fills a supervisor PIN (`apps/organizer/app/shift/attendance.tsx` — see UI audit).
- No upper time bound: check-in remains allowed hours/days after shift end (`:236-245` only enforces the early bound).

### Gap A2 — P1: no checkout UI path
`check_out_worker_safe` exists in `20261015000000...:1680-1745` and its SQL path is valid (`bookings.check_out_time` and `check_in_time` exist), but the worker app has no checkout action; `shift/checkin.tsx` only checks in. Completion therefore depends entirely on supervisor sign-off, which is broken (P0). **VERIFIED** for the absent UI; the RPC itself is **untested** but internally consistent with the schema.

### Gap A3 — P2: duplicate attendance rows possible
`attendance_records` has no unique constraint on `booking_id`. Once check-in is fixed, retries or supervisor actions can insert multiple rows, and downstream selects use `LIMIT 1` in places.

---

## 6. Completion → payout

| Step | RPC | Evidence | Status |
|---|---|---|---|
| supervisor approves hours | `complete_shift_and_approve_attendance` | above | ❌ broken |
| invoice generated | `generate_job_invoice_safe` | `20261015000007...:26-152` | ⚠️ callable by any authenticated user; mis-bills |
| invoice funded manually | `submit_invoice_payment_reference_safe` | `20261020000001...:175+` | VERIFIED writes reference |
| payout initiated | `initiate_worker_payout_safe` | `20261015000000...:2540-2615` | ⚠️ no ownership check; writes `payment_records` only |
| payout settled | admin UI action | `packages/shared/src/supabase/admin.ts` | VERIFIED manual status + UTR |

### Gap P1 — P0/P1: pay amount ignores verified hours
`initiate_worker_payout_safe` sets `v_payout_amount := COALESCE(v_booking.approved_total_pay, v_booking.agreed_total_pay)` (`20261015000000...:2585`). `approved_total_pay` is added by migration (`20261015000000...:1336`) but the only RPC that should write it (completion) does not. Therefore payout always falls back to the originally agreed total, regardless of hours worked or supervisor adjustment.

### Gap P2 — P1: payout initiation has no caller authorization
The function checks only `auth.uid() IS NOT NULL` and booking existence/status. Any authenticated user (including an unrelated worker or organizer) can call it for any completed booking, causing a `payment_records` row to be created/updated and an audit entry attributed to the attacker. **VERIFIED** at `20261015000000...:2540-2615`.

### Gap P3 — P1: "escrow" is a status flag
There is no provider call, ledger double-entry, or bank integration. `escrow_locked` means a row exists. Admin can mark `settled` with an arbitrary UTR. **VERIFIED** by absence of provider calls in the RPC and by admin data layer behavior.

### Gap P4 — P1: invoice billing math is wrong and unauthorized
`generate_job_invoice_safe`:
- has no organizer/staff check; any authenticated caller can generate an invoice for any job (`20261015000007...:26-152`);
- bills `total_pay * slots_total` rather than actual confirmed/attended headcount, so unfilled slots are charged;
- updates an already-issued invoice in place instead of issuing a credit/adjustment;
- always writes `is_sandbox = true`.

### Gap P5 — P1: invoice fiscal sequence table has no RLS
`invoice_fiscal_sequences` is created with DML grants to `authenticated` and no RLS (`20261020000001...:236-242`). Any authenticated user can read/increment/rewrite fiscal sequence counters, corrupting invoice numbering.

### Gap P6 — P2: webhook reconciliation is nonfunctional
`process_payment_webhook_safe` (or equivalent) writes columns that do not exist on `payment_reconciliation_logs` (`invoice_id`, `event_type`, `received_amount`, `metadata`) and reads columns absent from `organizer_invoices` (`escrow_funded_at`, `payment_reference`). No HTTP endpoint invokes it and no signature verification exists. **VERIFIED** by schema comparison; **INFERRED** that no webhook route is deployed.

---

## 7. Dispute lifecycle

Intended: `disputed` booking → admin reviews evidence → outcome (release/refund/cancel) → booking restored or cancelled → payment adjusted.

**VERIFIED defects:**

1. **P1 — signature mismatch.** Client `resolveDispute` sends `p_dispute_id`, `p_status`, `p_resolution_notes`, `p_adjusted_payout`, and `p_admin_id` (`packages/shared/src/supabase/admin.ts:288-300`). The DB function `admin_resolve_dispute_safe` takes `(p_dispute_id, p_status, p_resolution_notes, p_booking_outcome DEFAULT NULL, p_adjusted_payout DEFAULT NULL)` — there is no `p_admin_id` parameter, and the client never sends `p_booking_outcome`. The old overload was dropped, so PostgREST returns “function not found”. Dispute resolution is unusable.
2. **P1 — admin identity passed from client.** Even where accepted, `p_admin_id` is client-supplied rather than derived from `auth.uid()`. Combined with #1 this indicates the client/server contract drifted.
3. **P2 — no evidence model enforcement.** Dispute evidence is optional; admin can resolve with no attendance record because attendance itself is broken.

**Impact:** a worker or organizer can open a dispute but no admin can resolve it through the console.

---

## 8. Incident lifecycle

**VERIFIED**:

- Incident report screen collects category, description, location, and (optionally) photos.
- No audio recording is captured, yet the payload sets `hasAudioMemo: true` (`apps/worker/app/incident/report.tsx`).
- SLA badges (“30m RESPONSE”, “INSTANT GROUND DISPATCH”) are static copy, not derived from any SLA record.
- Evidence storage migration `20261022000006_incident_evidence_storage.sql` exists; upload path is implemented in the screen, but failure handling is inconsistent.
- `apps/worker/app/emergency.tsx` shows a stale “24 May 2025” lockdown notice and is not linked from navigation.

**Gap I1 — P1: false safety assurances.** Claiming an audio memo exists when it does not, and displaying response-time SLAs that no system tracks, is a user-safety and legal risk.

**Gap I2 — P2: no incident state machine.** There is no `status` transition, assignment, or escalation model in the app; incidents are write-only reports.

---

## 9. Notification lifecycle

```
domain mutation → INSERT notifications → DB webhook → Edge Function → Expo push
```

**VERIFIED**:

- `_notify` helper inserts rows in RPCs.
- `dispatch-push-notifications` reads `payload.record`, checks preferences, sends Expo push with service role.
- No signature/shared-secret verification; anyone who can reach the function URL can POST a forged payload and trigger pushes to arbitrary `user_id` values in the payload. Rate limiting/abuse controls absent.

**Gap N1 — P1: unauthenticated push trigger.** See `supabase/functions/dispatch-push-notifications/index.ts:29-56`.

**Gap N2 — P2: no webhook provisioning in repo.** The DB webhook that calls the function is configured outside migrations. If absent, pushes never fire even though rows are inserted.

---

## 10. Admin lifecycle

- Admin login uses Supabase auth, then checks role.
- `is_current_admin()` checks `profiles.role = 'admin'` but **not** `is_active` (`20261012000000...:568-578`). A suspended admin keeps RPC privileges until JWT expiry.
- Admin user/organizer creation routes (`apps/admin/src/app/api/auth/register-*`) use the service-role key and do not verify an admin session. Anyone who can reach the route can mint accounts. See `LOGIC_SECURITY_DATA_AUDIT.md`.
- Admin console “resolve dispute”, “approve payout”, and “mark settled” actions depend on the broken RPCs above.

---

## 11. Cross-cutting workflow defects

| ID | Severity | Defect | Evidence |
|---|---|---|---|
| X1 | P0 | Check-in RPC always errors | `20261020000000...:315-330` |
| X2 | P0 | Completion/sign-off RPC always errors | `20261020000001...:105-130` |
| X3 | P0 | Anonymous organizer registration can overwrite any user's password | `20261015000010...:229-383` |
| X4 | P1 | Dispute resolution contract mismatch | `packages/shared/src/supabase/admin.ts:288-300` |
| X5 | P1 | Payout has no caller authz and ignores verified hours | `20261015000000...:2540-2615` |
| X6 | P1 | Invoice generation unauthorized + over-bills unfilled slots | `20261015000007...:26-152` |
| X7 | P1 | Suspended admins retain power | `20261012000000...:568-578` |
| X8 | P1 | Offer accept has no overlap/expiry; decline has no last-minute cutoff | `20261021000002...` |
| X9 | P1 | Capacity sweep unscheduled and cross-tenant callable | `20261021000003...:246-261` |
| X10 | P1 | Push function unauthenticated | `supabase/functions/.../index.ts:29-56` |
| X11 | P1 | Fake attendance/earnings data presented as live; fake roster at HEAD (live in uncommitted work) | `apps/worker/app/(tabs)/earnings.tsx`, `apps/organizer/app/(tabs)/roster.tsx` |
| X12 | P2 | No checkout UI; no incident state machine; no webhook provisioning | screen inventory / migrations |

---

## 12. Minimum viable happy path after fixes

To make one real shift work end-to-end, all of the following must be true:

1. Organizer creates job **with coordinates**.
2. Worker KYC verified; applies; organizer sends offer.
3. Worker confirms before expiry and has no overlapping confirmed booking.
4. Worker is within 300 m and enters the correct code; `attendance_records` insert supplies `job_id`, `worker_id`, and real columns.
5. Supervisor signs off; completion writes `approved_total_pay` from verified hours.
6. Invoice reflects confirmed headcount, not slot capacity; escrow funding is recorded.
7. Payout authorization checks organizer/admin ownership; amount comes from `approved_total_pay`.
8. Settlement is performed through a real rail or an explicitly labeled manual process.

Today steps 4–8 cannot complete. Steps 1–3 are possible but unguarded against overlap/expiry.
