# Audit Summary — Opskl

> Audit date: 2026-10-21
> Repository: `/Users/aryan/Desktop/PROJECTS/OPSKIL`
> Branch / commit: `main` / `699a409d15969d6b53490cf6757061d966e07a9d`
> Mode: read-only, evidence-driven. No application source, schema, RLS, auth, payment, or data changes.
> Evidence labels: **VERIFIED** / **INFERRED** / **UNKNOWN**.

---

## 1. Verdict

**Not launch-ready. Not pilot-ready for real money or real safety incidents.**

The codebase is a substantial prototype with a coherent domain model, shared design system, and 340 passing unit tests, but the core shift lifecycle is broken at the database level, a critical authentication bypass exists, and multiple user-facing screens present fabricated operational and financial data as live.

| Area | Grade | Rationale |
|---|---|---|
| Product concept & domain model | B | Clear two-sided staffing model; sensible tables and roles |
| Architecture & code organization | B− | Clean monorepo/workspaces; shared logic; but client-heavy direct-to-DB design |
| Core workflow correctness | **F** | Check-in and completion RPCs cannot execute; dispute resolution broken |
| Security & authorization | **F** | Anon account takeover; suspended admins retain power; unauthenticated account minting/push |
| Financial correctness | **F** | No real rail; invoice over-bills; payout unauthorized and ignores hours |
| UI/UX honesty | **D** | Polished visuals, but fake earnings/SLAs, false success, and (at HEAD) a fake roster |
| Test credibility | **D** | 340 mock-based tests; no SQL execution; static invariants mistaken for integration |
| Documentation accuracy | **F** | “LAUNCH READY” claims contradicted by code |
| **Overall** | **F / not shippable** | Critical security + dead core lifecycle + fabricated data |

---

## 2. What was inspected

**VERIFIED** — repository-wide static audit:

- All workspaces: `apps/worker` (16 route files), `apps/organizer` (16 route files), `apps/admin` (Next.js console + 3 API routes), `packages/{shared,validation,design-system,config}`.
- All 35 SQL migrations in `supabase/migrations/` and `supabase/full_schema_release.sql`.
- Edge Function `supabase/functions/dispatch-push-notifications/index.ts`.
- RLS policies, grants, `SECURITY DEFINER` functions, triggers.
- Payment calculator/provider abstractions and admin data layer.
- 28 test files and test configuration.
- Environment/config names (no secret values printed).
- Existing `docs/` claims, including production-readiness reports.
- Current uncommitted organizer edits (left untouched).

**NOT inspected at runtime**: live Supabase project, deployed grants, Razorpay, OTP/SMTP, push delivery, mobile rendering, storage policies.

---

## 3. Commands run and results

| Command | Result |
|---|---|
| `npm test` | ✅ 340 tests passing (264 shared + 7 validation + 38 worker + 31 organizer), exit 0 |
| `npm run typecheck` | ❌ exit 2 — 4 errors, all in uncommitted organizer files |
| `CI=1 npm run build:admin` | ✅ Next.js 15 build, 8 routes, exit 0 |
| `DATABASE_URL='postgresql://invalid:invalid@127.0.0.1:1/invalid' node scripts/test_sql_integration.mjs` | ⚠️ 26/26 static invariants pass; live phase `ECONNREFUSED` (expected), exit 1 |
| `git status`, `git rev-parse` | 5 modified organizer files; HEAD `699a409` |
| `node -v` / `npm -v` | v26.11.1 / 11.20.0 |

**Deliberately not run**: `scripts/check_all_features.mjs` (sends real email OTPs), live DB phases, payment sandbox, Playwright E2E, mobile runtime, load/CVE scans.

Details: `TEST_BASELINE.md`.

---

## 4. Top findings

### P0 — must fix before anything else

1. **Anonymous account takeover** — `register_organizer_direct_safe` is executable by `anon` and `authenticated`, and rewrites any existing user's `encrypted_password` and promotes their role (`20261015000010...:229-383`, grant `:383`). Anyone who knows a victim's email can take over the account.
2. **Check-in always fails** — `check_in_worker_safe` writes nonexistent `bookings.updated_at` and `attendance_records.worker_latitude`/`worker_longitude`/`status`, and omits NOT NULL `job_id`/`worker_id`. The real location columns are `latitude`/`longitude`/`distance_to_venue_km`, and `bookings.check_in_time` does exist (`20261020000000...:315-330` vs `20261012000000...:213-242` + `20261012000003...:26-40`).
3. **Completion always fails** — `complete_shift_and_approve_attendance` writes nonexistent `bookings.updated_at` and `attendance_records.status`, and never writes `approved_total_pay` (`20261020000001...:105-130`). `bookings.check_out_time` does exist.

### P1 — severe

4. **Dispute resolution unusable** — client sends `p_admin_id` and omits `p_booking_outcome`; DB signature no longer has `p_admin_id` (`packages/shared/src/supabase/admin.ts:288-300` vs `20261015000000...:1892-1899`).
5. **Suspended admins keep power** — `is_current_admin()` ignores `is_active` (`20261012000000...:568-578`).
6. **Invoice RPC unauthorized + over-bills** — any authenticated user can generate invoices for any job; bills `total_pay * slots_total` even for unfilled slots; always `is_sandbox=true` (`20261015000007...:26-152`).
7. **Payout unauthorized + wrong amount** — any authenticated user can initiate a payout for any completed booking; uses `approved_total_pay` that is never written, falling back to agreed pay (`20261015000000...:2540-2615`).
8. **Fiscal sequence table exposed** — no RLS, DML granted to `authenticated` (`20261020000001...:236-242`).
9. **Geofence bypass** — skipped when job coordinates are NULL; client coordinates trusted; supervisor/staff bypass with no separate credential; no late upper bound (`20261020000000...:261-330`).
10. **Offer gaps** — acceptance has no overlap/expiry check; decline has no last-minute cutoff (`20261021000002...`).
11. **Capacity sweep** — any authenticated user can run it cross-tenant; never scheduled (`20261021000003...:246-261`).
12. **Push function unauthenticated** — forged payloads can push to any user (`supabase/functions/dispatch-push-notifications/index.ts:29-56`).
13. **Unauthenticated account minting** — `/api/auth/register-user` uses the service-role key with no admin session check and pre-confirmed emails.
14. **Webhook broken** — latest `process_payment_webhook_safe` writes nonexistent `escrow_funded_at`, `payment_reference`, `invoice_id`, `event_type`, `received_amount`, `metadata`; no HTTP route or signature verification (`20261015000003...:17-133`).
15. **No real money movement** — “escrow”/“settled” are database labels; admin settlement accepts any UTR; Razorpay code is unwired.

### P2 — significant

16. Migration order regressions (a later “hardening” migration overrides an earlier correct webhook/invoice implementation).
17. Admin login open redirect (`apps/admin/src/app/login/page.tsx:70-72`).
18. Static offline backup PIN `884 - 219`; hardcoded sandbox webhook secret.
19. Broad RLS assumptions around `organizer_memberships` and staff access.
20. No rate limiting, retention automation, or tamper-evident audit trail.

---

## 5. Workflow gaps

**The happy path cannot complete.** In order:

1. Organizer creates a job (works, but coordinates may be missing).
2. Worker applies/gets an offer (works, but overlap/expiry unguarded).
3. Worker confirms (works, but can double-book).
4. Worker checks in → **fails at SQL** (P0-2).
5. Supervisor signs off → **fails at SQL** (P0-3).
6. Invoice generated → **unauthorized and over-billed**.
7. Payout initiated → **unauthorized and uses wrong amount**.
8. Settlement → **manual database update, no rail**.

Additional gaps:
- No worker checkout UI.
- Declining a confirmed offer errors.
- Capacity sweep never runs, so slots leak.
- Disputes can be opened but not resolved.
- Incidents are write-only; no triage state; false audio/SLA claims.
- Emergency page is stale and unreachable.
- Push delivery depends on an unconfigured webhook and is forgeable.

Details: `WORKFLOW_AND_STATE_MAP.md`.

---

## 6. UI/UX flaws

**Trust-breaking, not cosmetic:**

- **Fabricated roster (at HEAD)**: five hardcoded shifts, fake applicant counts, fake escrow, May 2025 dates (`roster.tsx:375-991`). The active uncommitted work replaces these with live `filteredShifts`; this is a positive direction but is uncommitted, typecheck-failing, and still leaves stale filter chips (“May 2025”).
- **False earnings**: “✓ DISBURSED VIA UPI” and a no-op PDF download (`earnings.tsx:607,731-754`).
- **False success**: screening shortlist/decline always shows success (`screening.tsx:231,249`).
- **Fake supervisor proof**: blank PIN falls back to the worker's check-in code (`attendance.tsx:248,1021`).
- **Wrong booking**: check-in screen falls back to `bookings[0]` (`checkin.tsx:26-42`).
- **Onboarding trap**: profile cannot complete without UPI (`onboarding.tsx:321-328`).
- **Simulated safety**: no audio captured but `hasAudioMemo` can be true; unsupported “30m RESPONSE” / “INSTANT GROUND DISPATCH” badges (`incident/report.tsx:80-88,116-147,193`).
- **Stale emergency**: “24 May 2025” lockdown (`emergency.tsx:216`).
- **Contradictory finance copy**: “automated disbursement” vs. “no live rail” on adjacent screens (`finances.tsx:581` vs `:930`).
- **Hardcoded money**: ₹14,400 wage pool (`finances.tsx:551`).
- **Synthetic metrics**: `MUMBAI_PILOT_RECORDS` (18 fake shifts), 99.94% success/42 ms defaults, static contender count “38”.

Details: `UI_UX_AUDIT.md`.

---

## 7. Fake data inventory (short)

| Location | Fake claim |
|---|---|
| Organizer roster (HEAD only) | 5 shifts, applicant counts, escrow, dates; replaced by live data in uncommitted work |
| Organizer finances | ₹14,400 wage pool, automated payout |
| Worker earnings | “Disbursed via UPI”, PDF download |
| Worker my-shifts | “38 contenders” |
| Screening | success on failure, 3-hour countdown |
| Attendance | supervisor token authorization |
| Incident report | audio memo, 30m/instant SLA |
| Emergency | 24 May 2025 lockdown |
| Shared pilot metrics | 18 synthetic records; 99.94%/42 ms defaults |
| Offline | static PIN 884-219 |

---

## 8. Security and financial risks

**Security**
- Account takeover (P0).
- Privilege persistence for suspended admins.
- Unauthenticated account creation and push notifications.
- Unauthorized invoice/payout mutations.
- Cross-tenant capacity sweep.
- Trusted client coordinates and self-attested attendance.
- No rate limiting, weak error hygiene, open redirect.

**Financial**
- No regulated escrow or nodal account integration; “escrow” is a status.
- Invoice over-billing and in-place mutation of issued invoices.
- Payout amount ignores verified hours; no ownership check.
- Manual settlement with arbitrary UTR; no reconciliation against a provider.
- All invoices sandbox-flagged, so real money and test money are indistinguishable in records.
- Contradictory user messaging about disbursement.

---

## 9. Unknowns

- Actual deployed schema, grants, and migration order (especially whether `supabase/fix_permissions.sql` ran last).
- Whether the vulnerable RPC was ever reachable in production and whether accounts were taken over.
- Whether the push function is publicly deployed and whether any webhook secret is configured.
- Actual Razorpay mode/account and whether real money moved.
- Storage bucket policies and KYC document exposure.
- Real RLS behavior under production JWTs.
- Mobile runtime, accessibility, and performance.
- Dependency CVEs and infrastructure configuration.

---

## 10. Documents created

All under `docs/audit/`, no existing files overwritten:

1. `PROJECT_UNDERSTANDING.md` — product, topology, domain model, surfaces, trust boundaries.
2. `WORKFLOW_AND_STATE_MAP.md` — state machines, RPC-by-RPC transitions, gaps.
3. `UI_UX_AUDIT.md` — screen-by-screen findings, fake-data inventory, accessibility.
4. `LOGIC_SECURITY_DATA_AUDIT.md` — P0/P1/P2 findings with evidence, RLS/grants, financial logic.
5. `TEST_BASELINE.md` — commands, results, coverage gaps, what was not run.
6. `PRIORITIZED_IMPROVEMENT_PLAN.md` — batch plan with acceptance criteria and estimates.
7. `AUDIT_SUMMARY.md` (this file).

Existing audit/production docs were preserved unchanged.

---

## 11. Next safe batch (recommended, awaiting authorization)

**Batch 0 — containment, 3–5 days, no feature work:**

1. Revoke/drop `register_organizer_direct_safe`; audit affected accounts; rotate credentials.
2. Disable the check-in and completion CTAs behind a flag until their RPCs are fixed, so users get an honest “temporarily unavailable” state instead of a database error.
3. Remove `|| true` from screening; remove “disbursed”/PDF claims; finish and commit the live roster change; remove hardcoded finance data.
4. Gate `/api/auth/register-user` behind admin auth or remove it.
5. Add `is_active` to `is_current_admin()`.
6. Add a disposable-Postgres migration test harness (the single highest-leverage investment).
7. Fix the disputed RPC contract and the webhook/table-column mismatches.

**Do not** attempt a paid pilot, real payouts, or public launch until Batch 1 (check-in/completion) and Batch 2 (money correctness) pass end-to-end against a real test database.

---

## 12. Evidence index (critical citations)

| Claim | File / lines |
|---|---|
| Anon account takeover | `supabase/migrations/20261015000010_fix_organizer_registration_and_role_switching.sql:229-383`, `:383` |
| Check-in invalid columns | `supabase/migrations/20261020000000_audit_remediation_security_and_lifecycle.sql:315-330`; schema `20261012000000_initial_schema.sql:213-242` + `20261012000003_booking_attendance_engine.sql:26-40` |
| Completion invalid columns | `supabase/migrations/20261020000001_manual_escrow_pilot_and_supervisor_override.sql:105-130` |
| Dispute mismatch | `packages/shared/src/supabase/admin.ts:288-300`; `20261015000000_launch_fixes.sql:1892-1899` |
| Admin active flag | `supabase/migrations/20261012000000_initial_schema.sql:568-578` |
| Invoice authz/math | `supabase/migrations/20261015000007_fix_invoice_platform_settings_keys.sql:26-152` |
| Payout authz | `supabase/migrations/20261015000000_launch_fixes.sql:2540-2615` |
| Fiscal seq RLS | `supabase/migrations/20261020000001_manual_escrow_pilot_and_supervisor_override.sql:236-242` |
| Geofence bypass | `supabase/migrations/20261020000000_audit_remediation_security_and_lifecycle.sql:261-330` |
| Offer gaps | `supabase/migrations/20261021000002_worker_accept_decline_offer.sql:7-215` |
| Capacity sweep | `supabase/migrations/20261021000003_organizer_applications_and_capacity_sweep.sql:240-275` |
| Push auth | `supabase/functions/dispatch-push-notifications/index.ts:29-56` |
| Fake roster (HEAD) | `apps/organizer/app/(tabs)/roster.tsx:375-991`; replaced in uncommitted work |
| False screening | `apps/organizer/app/shift/screening.tsx:231,249` |
| False earnings | `apps/worker/app/(tabs)/earnings.tsx:607,731-754` |
| Check-in fallback | `apps/worker/app/shift/checkin.tsx:26-42` |
| Onboarding trap | `apps/worker/app/onboarding.tsx:321-328` |
| Incident fake audio/SLA | `apps/worker/app/incident/report.tsx:80-88,116-147,193` |
| Static PIN | `packages/shared/src/services/offline_queue_service.ts:196-198` |
| Synthetic metrics | `packages/shared/src/services/pilot_metrics_service.ts:33-487`; `system_killswitch_service.ts:12` |

---

## 13. Final statement

The repository contains real engineering effort and a coherent product vision, but the gap between what the UI claims and what the system does is the dominant risk. The correct next step is containment and a real database test harness — not more screens, not a launch, and not a paid pilot.

No fixes were applied. No user data, secrets, payments, or production systems were touched. Awaiting explicit authorization to begin Batch 0.
