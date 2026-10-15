# OPSKL Comprehensive Technical Review & Marketplace Gap Report

**Repository:** `Coderaryanyadav/OpsklTest`  
**Review Target:** Complete marketplace loop, security model, database integrity, mobile applications, admin portal, and statutory compliance.  
**Companion File for Implementation:** Master implementation blueprint across Phases 1 through 7.

---

## Executive Summary

A comprehensive architectural and functional review of the Opskl monorepo identified critical logical defects that collectively prevent the core marketplace loop from functioning:
1. **Database Triggers Block Legitimate Operations**: Triggers on `worker_profiles`, `organizer_profiles`, and `profiles` block profile updates, attendance approvals, and account deletion requests initiated by legitimate `SECURITY DEFINER` RPCs because they check only `is_current_admin()`.
2. **Organizer Provisioning Breakage**: Organizer email-OTP signup crashes because `business_contact_phone` is strictly `NOT NULL` in `organizer_profiles`, while email-OTP users possess no phone number upon initial auth signup.
3. **CSPRNG Dependency Risk**: Per-booking check-in passcodes rely on `gen_random_bytes(6)` from `pgcrypto` without schema qualification, failing on fresh Supabase project configurations.
4. **Data Exposure & RLS Privacy Leaks**: `supervisor_name` and `supervisor_phone` are broadcast to all authenticated users in `jobs`, and organizer GSTIN/billing data is exposed via permissive SELECT policies.
5. **State Machine & Slot Resurrection**: Cancelling a booking or recording a no-show unconditionally sets the associated job status to `'open'`, accidentally resurrecting cancelled, completed, past-dated, or paused events.
6. **Double-Booking & Direct Invite Vulnerabilities**: `confirm_worker_booking_safe` allows hiring workers for overlapping shift times and bypasses application requirements without platform gate controls.
7. **Attendance & Geofencing Flaws**: Worker check-in lacks time-window bounds, allows arbitrary geofence tolerances without config synchronization, and stored distances overflow `NUMERIC(5,2)` when users check in remotely.
8. **Dispute Resolution Incomplete**: Dispute resolution lacks rollback capabilities to pre-dispute states, allows arbitrary payout overwrites, and lacks `under_review` arbitration states.
9. **Financial Accounting & Invoice Gaps**: Invoices lack durable FY sequencing (`OPS/26-27/00001`), overwrite totals after escrow is funded, and webhook handling fails to convert paise to rupees.
10. **Client-Side Assumptions & Unverified Claims**: Production copy asserts "100% Wage Guarantee", "Escrow-Protected Payouts", and "Cryptographically Sealed" without backing infrastructure.

---

## Detailed Findings Matrix

| Ref | Domain | File | Line(s) | Severity | Root Cause & Failure Mode | Remediation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1.1** | SQL / Triggers | `supabase/migrations/20261012000000_initial_schema.sql` | 814–885, 353–385 | **P0 Blocker** | `check_worker_profile_update` & `prevent_role_escalation` raise exceptions when non-admins invoke trusted RPCs (`complete_shift_and_approve_attendance`, `request_account_deletion_safe`). | Implement transaction-local flag via `set_config('opskl.trusted', '1', true)` and trigger check `current_setting('opskl.trusted', true) = '1'`. |
| **1.2** | SQL / Disputes | `supabase/migrations/20261012000003_booking_attendance_engine.sql` | 615–680 | **P0 Blocker** | Direct INSERT policy allows client bypassing RPC; `details` column omitted; no length check on reason. | Drop direct INSERT policy; enforce `length(trim(p_reason)) >= 10`; store `details = COALESCE(NULLIF(trim(p_evidence),''), p_reason)`. |
| **1.3a** | SQL / Auth | `supabase/migrations/20261012000000_initial_schema.sql` | 449–456, 529–532 | **P0 Blocker** | `organizer_profiles.business_contact_phone` is `NOT NULL`, but email-OTP signup passes `NULL`, failing trigger `handle_new_user_provisioning`. | Relax column to allow empty string / drop NOT NULL; use `COALESCE(v_phone, '')`. |
| **1.3b** | SQL / Crypto | `supabase/migrations/20261012000002_organizer_management.sql` | 305–306 | **P1 Defect** | `gen_random_bytes(6)` fails on standard Supabase setups without explicit `extensions.` schema qualification. | Replace with `upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))` prefixed by `'OP-'`. |
| **1.4** | SQL / Privacy | `supabase/migrations/20261012000000_initial_schema.sql`<br>`20261012000001_marketplace_discovery.sql` | 687–688<br>22–30 | **P0 Privacy** | `jobs` table exposes `supervisor_name/phone` to public discovery; organizer profile allows worker view. | Create `public_jobs` view; hide supervisor contact behind RPC `get_job_contact(p_job_id)`; revoke anon from `public_organizer_cards`. |
| **1.5** | SQL / Lifecycle | `supabase/migrations/20261012000002_organizer_management.sql`<br>`20261012000003_booking_attendance_engine.sql` | 426–475<br>480–486 | **P0 Data Integrity** | Jobs lack transition validator; `cancel_booking_safe` resets job status to `'open'` unconditionally, resurrecting finished or cancelled shifts. | Create `validate_job_transition()`; only reopen if job is (`open`, `filling`, `filled`) and date is today or future; cancel job atomically with refund logs. |
| **1.6** | SQL / Hiring | `supabase/migrations/20261012000002_organizer_management.sql` | 200–260 | **P0 Concurrency** | Double-booking allowed across overlapping shift times; unverified organizers can book workers; raw notifications bypass preferences. | Enforce no overlapping bookings; require organizer `verified` or admin; introduce internal `_notify()` helper checking preferences. |
| **1.7** | SQL / Applications | `supabase/migrations/20261012000001_marketplace_discovery.sql`<br>`20261012000002_organizer_management.sql` | 40–150<br>360–420 | **P1 UX** | Applications cannot be withdrawn and re-applied; discovery feed filters jobs in JavaScript instead of SQL; application statuses lack transition checks. | Implement `get_discovery_feed` RPC with keyset pagination; permit re-apply from `withdrawn`; add `withdraw_application_safe`. |
| **1.8** | SQL / Attendance | `supabase/migrations/20261012000003_booking_attendance_engine.sql` | 150–260, 350–430 | **P0 Fraud** | Check-in has no time window guards; distance exceeds `NUMERIC(5,2)` on remote check-in; overtime hours lack server-side cap and calculations. | Restrict check-in window; widen `distance_to_venue_km` to `NUMERIC(8,2)`; calculate hours adjustment in SQL and store `approved_total_pay`. |
| **1.9** | SQL / Admin | `supabase/migrations/20261012000006_admin_and_trust_operations.sql` | 150–250, 470–560 | **P0 Compliance** | Account deletion purge allows unauthorized callers; verification approval sets verified without required document set; dispute outcome lacks state restoration. | Restrict purge to service-role/admin; restore pre-dispute status on dismissal; implement `cancel_account_deletion_safe`; create admin metrics SQL view. |
| **1.10** | SQL / Payments | `supabase/migrations/20261012000004_payments_and_earnings.sql` | 184–265, 301–360 | **P0 Financial** | Invoices update totals after `escrow_funded`; random invoice codes; webhooks treat paise as rupees; hardcoded `is_sandbox=true`. | Sequence `OPS/26-27/00001`; freeze funded invoices; convert paise `/100.00`; add manual settlement RPCs `admin_mark_invoice_funded`, `admin_mark_payout_settled`. |
| **1.11** | SQL / Jobs | `supabase/migrations/20261012000002_organizer_management.sql` | 50–180 | **P1 Schema** | `create_job_safe` rejects overnight shifts (`end_time <= start_time`); misses `latitude`, `longitude`, `eligibility_criteria` inserts. | Support overnight shifts with `end_date = date + 1`; store coordinates with India bounding box validation (6–38 N, 68–98 E). |
| **2.1–2.10** | Shared & UI | `packages/shared/src/`<br>`packages/design-system/src/` | Multiple files | **P1 DX/Quality** | `fetchUserNotifications` returns fake fallback on error; `AuthContext` drops sessions on network error; WCAG AA contrast failures on muted text. | Remove fake notification fallback; handle PGRST116 distinctly; enforce accessible colors (`#6B6B6B`, `#15803D`); remove server crypto from mobile bundles. |
| **3.1–3.10** | Worker Mobile | `apps/worker/app/`<br>`apps/worker/src/` | Multiple files | **P0 UX** | Hardcoded mock profile IDs; check-in lacks GPS integration; My Shifts lacks active tab prioritization; KYC flow missing; unverified wage claims. | Integrate `expo-location`; connect new KYC submission flow; implement true feed pagination via RPC; purge unbacked marketing claims. |
| **4.1–4.8** | Organizer Mobile | `apps/organizer/app/`<br>`apps/organizer/src/` | Multiple files | **P0 Operational** | Hardcoded mock notification profile `'org-current-profile'`; shift creation lacks overnight support and geocoding; roster lacks applicant status actions. | Implement organizer onboarding & KYC; rewrite shift creation wizard with overnight and geocoding; provide real-time roster and attendance console. |
| **5.1–5.9** | Admin Portal | `apps/admin/src/app/`<br>`apps/admin/src/components/` | Multiple files | **P1 Compliance** | Admin portal uses tab-state without deep links or back-button support; lacks MFA enforcement; fake metrics in pilot overview. | Convert to Next.js file routes; connect to SQL aggregation views; wire verification image review via signed URLs; add dispute arbitration drawer. |
| **6.1–6.5** | Build & Infra | `eas.json`, `app.json`, `.gitignore` | Multiple files | **P1 Security** | Missing environment variables for EAS profiles; unused permissions; missing build packages; no edge function directory. | Fix EAS config; prune mobile permissions; add `supabase/functions/` with webhook, purge, and reminder edge functions; setup CI pipeline. |
| **7.1** | Marketing Audit | Across monorepo | Multiple files | **P2 Compliance** | Statements such as "100% WAGE GUARANTEE", "Escrow-Protected Payouts", "Indian GST Act Compliant" are unverified and create statutory liability. | Replace unverified claims with plain, accurate operational descriptions ("paid after attendance is approved", "provisional GST invoice"). |

---

## Plan of Execution & Architectural Invariants

### Invariants Maintained
1. **Applied Migrations Are Read-Only**: All database changes are housed in `supabase/migrations/20261015000000_launch_fixes.sql`. `supabase/full_schema_release.sql` is rebuilt by concatenation.
2. **Security Definer & Search Path**: All RPCs strictly specify `SECURITY DEFINER` with `SET search_path = public`. Identity is derived solely from `auth.uid()`.
3. **Phase-by-Phase Verification**: Type checks (`npm run typecheck`), existing Jest unit tests, and integration test suites are validated at each phase before advancing.
4. **Decisions Documented**:
   - *Memberships*: Owner-only for pilot release; multi-tenant memberships removed from `confirm_worker_booking_safe`.
   - *Direct Invites*: Direct invites without an application are rejected by default; configurable via `platform_settings.allow_direct_invites`.
   - *KYC Documents*: Worker = Aadhaar OR PAN; Organizer = GSTIN OR Proprietor PAN.
   - *Pilot Settlements*: Default to manual settlement flow (`admin_mark_invoice_funded`, `admin_mark_payout_settled`).

---

*End of OPSKL Review Report. Proceeding with Phase 1 execution.*
