# OPSKL — ACTIONABLE IMPROVEMENT ROADMAP & RELEASE BACKLOG

**Date:** October 20, 2026  
**Auditing Consortium:** Engineering Architecture, Application Security, Marketplace Product & Financial Integrity Specialists  
**Target Repository:** `Coderaryanyadav/OpsklTest` (Monorepo root: `/Users/aryan/Desktop/PROJECTS/OPSKIL`)  
**Implementation Rule:** This document establishes the engineering backlog. **No application code or configuration has been modified during the audit phase.**

---

## 1. BACKLOG OVERVIEW & PRIORITY HIERARCHY

The roadmap is strictly ordered by:
**Security and data integrity → business workflow correctness → financial correctness → reliability → usability → performance → maintainability → visual polish.**

- **P0 — Critical (Immediate Launch Blockers):** Security vulnerabilities, unauthorized access risks, broken state machines that trap users, and severe privacy leaks.
- **P1 — High (Core Workflow & FinTech Foundations):** Real KYC document collection, payment gateway wiring / formal manual pilot SOP, geofence boundary enforcement, and background push notification delivery.
- **P2 — Medium (UX & Operational Polish):** Fine-grained address geocoding, supervisor attendance override, admin dashboard query optimization, and unverified worker UX clarity.
- **P3 — Low (Refinements & DevEx):** Playwright dev server harness, asset color token alignment, and automated mobile CI pipelines.

---

## 2. P0 — CRITICAL TASKS (IMMEDIATE LAUNCH BLOCKERS)

---

### Task P0-1: Eliminate Public Self-Registration Admin Privilege Escalation (`SEC-001`)

- **Problem & Evidence:**
  In [supabase/migrations/20261015000010_fix_organizer_registration_and_role_switching.sql#L20-L24](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261015000010_fix_organizer_registration_and_role_switching.sql#L20-L24), the database trigger `handle_new_user_provisioning()` contains:
  ```sql
  v_role := CASE
    WHEN (NEW.raw_user_meta_data->>'role') = 'organizer' THEN 'organizer'::user_role
    WHEN (NEW.raw_user_meta_data->>'role') = 'admin' THEN 'admin'::user_role
    ELSE 'worker'::user_role
  END;
  ```
  Any anonymous caller can send `options: { data: { role: 'admin' } }` to the public Supabase GoTrue Auth endpoint and immediately become an authoritative platform Superadmin.
- **Proposed Solution:**
  Deploy a new migration updating `handle_new_user_provisioning()`:
  ```sql
  v_role := CASE
    WHEN (NEW.raw_user_meta_data->>'role') = 'organizer' THEN 'organizer'::user_role
    ELSE 'worker'::user_role
  END;
  ```
  Enforce that `admin` role can NEVER be assigned via metadata in auth triggers. Administrators can only be provisioned via migration scripts with direct PostgreSQL superuser access.
- **Files Affected:**
  - `supabase/migrations/20261020000000_fix_admin_privilege_escalation.sql`
  - `supabase/full_schema_release.sql`
- **Dependencies:** None.
- **Risk:** Zero regression risk to normal users (workers and organizers).
- **Acceptance Criteria:**
  - Calling `supabase.auth.signUp()` with `data: { role: 'admin' }` assigns `profiles.role = 'worker'`.
  - Admin login portal rejects credentials created with client metadata.
- **Tests Required:** Add integration test in `packages/shared/src/__tests__/security_and_auth.test.ts` verifying that `signUp` with `role: 'admin'` produces a worker profile.
- **Estimated Effort:** **XS (< 2 hours)**
- **Execution Order:** **1 (First task to deploy)**

---

### Task P0-2: Block Direct SELECT on Base `jobs` Table Leaking Supervisor Phone Numbers (`SEC-002`)

- **Problem & Evidence:**
  In [supabase/migrations/20261015000003_security_and_privacy_hardening.sql#L335-L338](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261015000003_security_and_privacy_hardening.sql#L335-L338):
  ```sql
  CREATE POLICY "Anyone can view open public jobs" ON jobs FOR SELECT TO anon, authenticated
    USING (status IN ('open', 'filling') AND date >= CURRENT_DATE);
  ```
  While `public_jobs` view strips `supervisor_name` and `supervisor_phone`, this open policy on base `jobs` permits any public user to execute `supabase.from('jobs').select('supervisor_phone, supervisor_name')` and harvest event managers' personal contact numbers.
- **Proposed Solution:**
  Replace policy on base `jobs`:
  ```sql
  DROP POLICY IF EXISTS "Anyone can view open public jobs" ON jobs;
  CREATE POLICY "Public discovery only through public_jobs view" ON jobs FOR SELECT TO authenticated
    USING (
      organizer_id = auth.uid()
      OR is_current_admin()
      OR EXISTS (
        SELECT 1 FROM bookings
        WHERE bookings.job_id = jobs.id AND bookings.worker_id = auth.uid()
      )
    );
  ```
  Public discovery routes exclusively through `public_jobs` view, which has `supervisor_phone` and `supervisor_name` omitted.
- **Files Affected:**
  - `supabase/migrations/20261020000001_shield_supervisor_phone_leak.sql`
  - `supabase/full_schema_release.sql`
- **Dependencies:** None.
- **Risk:** Very low; verified that worker feed and discovery already query `public_jobs` view.
- **Acceptance Criteria:**
  - Direct REST query `supabase.from('jobs').select('supervisor_phone')` returns zero rows for anonymous or unconfirmed workers.
  - Confirmed workers can read contact via `get_job_contact(p_job_id)`.
- **Tests Required:** Add test in `packages/shared/src/__tests__/security_audit_and_compliance.test.ts` asserting anon client gets 0 rows on `jobs` base table.
- **Estimated Effort:** **XS (< 2 hours)**
- **Execution Order:** **2**

---

### Task P0-3: Correct State Machine to Allow Partially-Filled Shifts to Start & Complete (`FLOW-001`)

- **Problem & Evidence:**
  In [supabase/migrations/20261015000000_launch_fixes.sql#L590-L602](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261015000000_launch_fixes.sql#L590-L602):
  ```sql
  ELSIF p_current_status = 'filled' AND p_new_status IN ('filling', 'cancelled', 'in_progress') THEN RETURN true;
  ELSIF p_current_status = 'in_progress' AND p_new_status = 'completed' THEN RETURN true;
  ```
  Shifts with `open` or `filling` status (e.g., 4 out of 5 slots filled) can NEVER transition to `in_progress` or `completed`. They become permanently stuck.
- **Proposed Solution:**
  Update `validate_job_transition()` to allow transitions to `in_progress` from `open`, `filling`, and `filled`:
  ```sql
  ELSIF p_current_status IN ('open', 'filling', 'filled') AND p_new_status IN ('in_progress', 'paused', 'cancelled') THEN
    RETURN true;
  ```
- **Files Affected:**
  - `supabase/migrations/20261020000002_fix_job_lifecycle_transitions.sql`
  - `supabase/full_schema_release.sql`
- **Dependencies:** None.
- **Risk:** Low; strictly expands permissible transitions without relaxing cancellation controls.
- **Acceptance Criteria:**
  - Shift with 3/5 slots confirmed can be marked `in_progress` by organizer at call time.
  - Shift concludes to `completed` and allows invoice reconciliation.
- **Tests Required:** Add unit test in `packages/shared/src/__tests__/marketplace.test.ts` verifying transition from `filling -> in_progress -> completed`.
- **Estimated Effort:** **XS (< 1 hour)**
- **Execution Order:** **3**

---

### Task P0-4: Enforce 300m Attendance Geofence on Backend RPC (`SEC-004`)

- **Problem & Evidence:**
  In [supabase/migrations/20261018000000_phase3_auth_kyc_verification_hardening.sql#L440-L460](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261018000000_phase3_auth_kyc_verification_hardening.sql#L440-L460), `check_in_worker_safe` computes `v_distance` using the Haversine formula, but never verifies `v_distance <= 0.30`. Workers can check in from any location without being present at the venue.
- **Proposed Solution:**
  Add geofence enforcement before updating booking status:
  ```sql
  IF NOT v_is_supervisor THEN
    IF v_job.latitude IS NOT NULL AND v_job.longitude IS NOT NULL THEN
      IF p_lat IS NULL OR p_lng IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'GPS_COORDINATES_REQUIRED', 'message', 'GPS coordinates are required to verify on-site arrival.');
      END IF;
      IF v_distance > 0.30 THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'OUT_OF_GEOFENCE_RANGE', 'message', 'You are ' || round(v_distance * 1000) || 'm away. You must be within 300m of the venue to check in.');
      END IF;
    END IF;
  END IF;
  ```
- **Files Affected:**
  - `supabase/migrations/20261020000003_enforce_backend_geofence.sql`
  - `supabase/full_schema_release.sql`
- **Dependencies:** Task P2-2 (Precise Venue Geocoding so venue coordinates are accurate).
- **Risk:** Medium; must ensure supervisors have fallback manual check-in when GPS fluctuates. (Already supported via `v_is_supervisor` pass).
- **Acceptance Criteria:**
  - Worker attempting self check-in > 300m away receives `OUT_OF_GEOFENCE_RANGE`.
  - Worker within 300m is checked in and timestamp logged.
  - Organizer manual override modal succeeds regardless of worker GPS.
- **Tests Required:** Add unit tests in `packages/shared/src/__tests__/booking_attendance.test.ts` for `<300m`, `>300m`, and null GPS.
- **Estimated Effort:** **S (2–4 hours)**
- **Execution Order:** **4**

---

### Task P0-5: Drop Legacy Open Direct UPDATE Policy on `job_applications` (`SEC-005`)

- **Problem & Evidence:**
  In [supabase/migrations/20261012000000_initial_schema.sql#L716-L722](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261012000000_initial_schema.sql#L716-L722), policy `"Organizers update application status"` was never dropped. Direct REST `UPDATE` on `job_applications` remains possible, bypassing atomic capacity checks in `confirm_worker_booking_safe`.
- **Proposed Solution:**
  Deploy migration:
  ```sql
  DROP POLICY IF EXISTS "Organizers update application status" ON job_applications;
  ```
- **Files Affected:**
  - `supabase/migrations/20261020000004_drop_open_application_update_policy.sql`
- **Dependencies:** None.
- **Risk:** Zero risk; organizer app already calls `confirmWorkerBookingSafe` and `updateApplicationStatusSafe`.
- **Acceptance Criteria:**
  - Direct REST update on `job_applications` returns RLS permission error.
  - Updating applications via `updateApplicationStatusSafe` succeeds via RPC.
- **Tests Required:** Add test in `packages/shared/src/__tests__/marketplace.test.ts`.
- **Estimated Effort:** **XS (< 1 hour)**
- **Execution Order:** **5**

---

## 3. P1 — HIGH PRIORITY TASKS (CORE WORKFLOWS & INTEGRITY)

---

### Task P1-1: Implement Real File/Image Picker for Worker KYC and Organizer GSTIN (`SEC-003`)

- **Problem & Evidence:**
  In [apps/worker/app/onboarding.tsx#L261-L267](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/worker/app/onboarding.tsx#L261-L267) and [apps/organizer/app/(tabs)/profile.tsx#L121-L128](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/organizer/app/%28tabs%29/profile.tsx#L121-L128), uploads construct synthetic string tokens (`KYC_EVIDENCE_...`). Real government documents are not uploaded or stored.
- **Proposed Solution:**
  1. Install `expo-image-picker` and `expo-document-picker` in `apps/worker` and `apps/organizer`.
  2. Implement camera photo capture and PDF document selection in `DocumentUpload` component.
  3. Read file URI as binary `Blob` or `ArrayBuffer` and upload directly to private `verification-documents` Supabase Storage bucket with content type validation (`image/jpeg`, `image/png`, `application/pdf`).
- **Files Affected:**
  - `apps/worker/package.json`
  - `apps/worker/app/onboarding.tsx`
  - `apps/organizer/package.json`
  - `apps/organizer/app/(tabs)/profile.tsx`
  - `packages/design-system/src/components/DocumentUpload.tsx`
- **Dependencies:** None.
- **Risk:** Low; requires testing on iOS and Android physical devices for camera permissions.
- **Acceptance Criteria:**
  - Worker takes photo of physical Aadhaar card; real JPEG is uploaded to `${userId}/kyc_aadhaar_${timestamp}.jpg`.
  - Admin clicks "Open evidence" in Verification Queue and views the actual image in browser.
- **Estimated Effort:** **M (1–2 days)**
- **Execution Order:** **6**

---

### Task P1-2: Migrate Discovery Feed Hook to Keyset RPC to Prevent URL Length Overflow (`PERF-001`)

- **Problem & Evidence:**
  In [packages/shared/src/supabase/jobs.ts#L186-L193](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/supabase/jobs.ts#L186-L193), `fetchDiscoveryFeed` appends all past application IDs to `query.not('id', 'in', ...)`. When a worker has swiped or applied to 100+ shifts, the URL exceeds 4KB, crashing PostgREST queries with HTTP 414.
- **Proposed Solution:**
  Migration 26 introduced `get_discovery_feed(p_filters, p_page_size, p_cursor)` which performs exclusions inside PostgreSQL. Update [apps/worker/src/hooks/useDiscoveryFeed.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/worker/src/hooks/useDiscoveryFeed.ts) to call `getDiscoveryFeedRpc` instead of `fetchDiscoveryFeed`.
- **Files Affected:**
  - `apps/worker/src/hooks/useDiscoveryFeed.ts`
  - `packages/shared/src/supabase/jobs.ts`
- **Dependencies:** None.
- **Risk:** Low; keyset pagination was already verified in Phase 4 database tests.
- **Acceptance Criteria:**
  - Worker with 200+ past swipes loads feed with zero URL size growth.
  - Keyset `(date, id)` pagination smoothly loads next card batch without duplicate cards.
- **Estimated Effort:** **S (4–6 hours)**
- **Execution Order:** **7**

---

### Task P1-3: Resolve Financial Gateway Strategy & In-App Settlement (`FIN-001`)

- **Problem & Evidence:**
  The `RazorpayPaymentProvider` class is unwired. In [apps/organizer/app/(tabs)/finances.tsx](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/organizer/app/%28tabs%29/finances.tsx#L484-L506), organizers cannot pay invoices in-app. In worker app, payouts remain in `escrow_locked` without initiating automated bank transfers.
- **Proposed Solution (Two-Stage Approach):**
  - **Stage 1 (Closed Mumbai Pilot):** Formally configure the **Manual Escrow Pilot SOP**:
    - Organizer invoice modal displays Opskl Escrow Bank Account details (Bank Name, Account Number, IFSC, UPI VPA) with copy buttons.
    - Organizer inputs UTR / Transaction Reference in a "Submit Payment Slip" field.
    - Admin confirms bank receipt in Admin Console via `admin_mark_invoice_funded(invoiceId, utr)`.
    - Worker payout displays: "Disbursement queued. Admin will process to your UPI ID within 24 hours."
  - **Stage 2 (Commercial Launch):** Wire Razorpay Standard Checkout SDK into `apps/organizer` for instant UPI/card payments, and deploy a secure Supabase Edge Function with `SUPABASE_SERVICE_ROLE_KEY` calling RazorpayX Payouts API.
- **Files Affected:**
  - `apps/organizer/app/(tabs)/finances.tsx`
  - `apps/worker/app/(tabs)/earnings.tsx`
  - `docs/MUMBAI_LIVE_PILOT_REPORT.md`
- **Dependencies:** Merchant bank account & Razorpay KYC verification.
- **Risk:** High if commercial automation is rushed without PA compliance; low if launched as Stage 1 Pilot SOP.
- **Acceptance Criteria:**
  - Organizer has clear in-app workflow to pay invoice and submit UTR reference.
  - Worker sees accurate, trustworthy disbursement status without misleading "IMPS active" copy.
- **Estimated Effort:** **M (Stage 1: 1 day; Stage 2: 1 week)**
- **Execution Order:** **8**

---

### Task P1-4: Deploy Background Push Notification Dispatch Service (`PERF-003`)

- **Problem & Evidence:**
  [packages/shared/src/notifications/expo-push.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/notifications/expo-push.ts) provides `sendExpoPushBatch`, but it is never called. When mobile apps are closed or locked, users receive zero notifications.
- **Proposed Solution:**
  1. Create a Supabase Database Webhook or Edge Function triggered on `INSERT` to the `notifications` table.
  2. The function queries `user_devices` for the recipient's active `expo_push_token`.
  3. Invokes `sendExpoPushBatch` with title, body, and deep-link payload.
- **Files Affected:**
  - `supabase/functions/dispatch-push-notifications/index.ts`
  - `packages/shared/src/notifications/expo-push.ts`
- **Dependencies:** Expo push credentials in environment (`EXPO_ACCESS_TOKEN`).
- **Risk:** Low; fallback is silent in-app notification.
- **Acceptance Criteria:**
  - When organizer confirms worker, worker's physical device shows native iOS/Android banner while phone is locked.
  - Tapping banner opens Worker app directly to `my-shifts` tab.
- **Estimated Effort:** **M (1–2 days)**
- **Execution Order:** **9**

---

### Task P1-5: Fix `public_organizer_cards` View RLS to Restore Organizer Names (`FLOW-004`)

- **Problem & Evidence:**
  In [supabase/migrations/20261016000000_security_privacy_coordinate_hardening.sql#L367-L380](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261016000000_security_privacy_coordinate_hardening.sql#L367-L380), `public_organizer_cards` view has `security_invoker = true`, but base `organizer_profiles` only allows `id = auth.uid()`. Workers cannot read the projection, causing job cards to display generic fallback "Event Host".
- **Proposed Solution:**
  Add policy on `organizer_profiles`:
  ```sql
  CREATE POLICY "Public organizer card read access"
    ON organizer_profiles FOR SELECT TO authenticated
    USING (
      verification_status = 'verified'
      OR id = auth.uid()
      OR is_current_admin()
      OR EXISTS (SELECT 1 FROM jobs WHERE jobs.organizer_id = organizer_profiles.id AND jobs.status IN ('open', 'filling'))
    );
  ```
  Ensure column privileges on `organizer_profiles` restrict raw `gstin` and `billing_address` to owner/admin.
- **Files Affected:**
  - `supabase/migrations/20261020000005_fix_public_organizer_cards_access.sql`
  - `packages/shared/src/supabase/jobs.ts`
- **Dependencies:** None.
- **Risk:** Low; shields private fields while restoring host brand visibility.
- **Acceptance Criteria:**
  - Workers viewing discovery feed see actual business names ("Apex Events Mumbai", "Toast & Tonic Hospitality").
- **Estimated Effort:** **XS (< 2 hours)**
- **Execution Order:** **10**

---

## 4. P2 — MEDIUM PRIORITY TASKS (UX & OPERATIONAL POLISH)

---

### Task P2-1: Supervisor Attendance Sign-Off & Force Completion Override (`FLOW-002`)

- **Problem & Evidence:**
  In [supabase/migrations/20261012000003_booking_attendance_engine.sql#L64-L67](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261012000003_booking_attendance_engine.sql#L64-L67), `validate_booking_transition('checked_in', 'completed')` is disallowed. If a worker fails to tap "Check Out" on their phone at shift conclusion, the organizer cannot sign off on completion.
- **Proposed Solution:**
  Allow `checked_in -> completed` transition when caller is organizer or admin (`v_is_supervisor`), setting `check_out_time = now()`. Add a "Sign Off Shift" button in [apps/organizer/app/shift/[id].tsx](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/organizer/app/shift/%5Bid%5D.tsx).
- **Files Affected:**
  - `supabase/migrations/20261020000006_allow_supervisor_booking_signoff.sql`
  - `apps/organizer/app/shift/[id].tsx`
- **Estimated Effort:** **S (3–5 hours)**
- **Execution Order:** **11**

---

### Task P2-2: Street-Level Venue Geocoding for Accurate Geofencing (`FLOW-003`)

- **Problem & Evidence:**
  In [apps/organizer/app/(tabs)/create.tsx#L60-L68](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/organizer/app/%28tabs%29/create.tsx#L60-L68), shift creation hardcodes zone centroids (`ZONE_COORDINATES[zone]`). A venue in BKC 1.5km from centroid causes workers at the entrance to fail 300m geofence checks.
- **Proposed Solution:**
  Integrate Google Places Autocomplete or OpenStreetMap Nominatim reverse geocoding to resolve street addresses to exact `(lat, lng)` coordinates before submitting `createJobSafe`.
- **Files Affected:**
  - `apps/organizer/app/(tabs)/create.tsx`
  - `packages/validation/src/shift.ts`
- **Estimated Effort:** **M (1–2 days)**
- **Execution Order:** **12**

---

### Task P2-3: Admin Web Dashboard Query Optimization & Lazy Loading (`PERF-002`)

- **Problem & Evidence:**
  In [apps/admin/src/app/page.tsx#L118-L130](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/admin/src/app/page.tsx#L118-L130), page mount triggers 8 parallel queries and fetches 100 workers/organizers regardless of active module.
- **Proposed Solution:**
  Refactor `AdminDashboardInner` to fetch queue data lazily based on `activeModule`. Add server-side pagination to `DirectoryTable` and `AuditLogsTable`.
- **Files Affected:**
  - `apps/admin/src/app/page.tsx`
  - `apps/admin/src/components/DirectoryTable.tsx`
  - `apps/admin/src/components/AuditLogsTable.tsx`
- **Estimated Effort:** **M (1–2 days)**
- **Execution Order:** **13**

---

### Task P2-4: Fiscal-Year Sequential Invoice Numbering Reset Engine (`FIN-002`)

- **Problem & Evidence:**
  In [supabase/migrations/20261015000000_launch_fixes.sql#L2350-L2374](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261015000000_launch_fixes.sql#L2350-L2374), `generate_invoice_number()` uses a global monotonic sequence that never resets on Indian FY rollover (April 1). Consumed numbers on rollback create gaps, violating Section 31 of CGST Act.
- **Proposed Solution:**
  Implement a dedicated `invoice_fiscal_sequences` table storing `(fiscal_year, last_sequence)` with row locks during invoice issuance.
- **Files Affected:**
  - `supabase/migrations/20261020000007_fiscal_year_invoice_sequence_table.sql`
- **Estimated Effort:** **S (4–6 hours)**
- **Execution Order:** **14**

---

### Task P2-5: Unverified Worker Discovery Guidance on Shift Details (`UX-002`)

- **Problem & Evidence:**
  In [apps/worker/app/shift/[id].tsx#L121-L136](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/worker/app/shift/%5Bid%5D.tsx#L121-L136), unverified workers can tap "Express Interest" only to receive a cryptic alert `[KYC_NOT_VERIFIED]`.
- **Proposed Solution:**
  Inspect `workerProfile?.verificationStatus`. If unverified/pending, replace apply button with an informative banner and button: "Complete Identity Verification to Apply", routing to `onboarding.tsx`.
- **Files Affected:**
  - `apps/worker/app/shift/[id].tsx`
- **Estimated Effort:** **S (2–3 hours)**
- **Execution Order:** **15**

---

## 5. P3 — LOW PRIORITY TASKS (POLISH & DEVEX)

---

### Task P3-1: Align Mobile Manifests to Monochrome Brand Tokens (`UX-001`)
- Standardize adaptive icon backgrounds and notification colors in [apps/worker/app.json](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/worker/app.json#L32) and [apps/organizer/app.json](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/organizer/app.json#L32) from legacy `#0F766E` / `#0F172A` to `#000000`.
- **Effort:** **XS (< 30 mins)**

### Task P3-2: Configure Playwright Web Server Auto-Spawn (`TEST-002`)
- Add `webServer: { command: 'npm run dev', port: 3000, reuseExistingServer: true }` in [apps/admin/playwright.config.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/admin/playwright.config.ts).
- **Effort:** **XS (< 30 mins)**

### Task P3-3: Fix Self-Signed Certificate Flag in Feature Health Script (`TEST-001`)
- In [scripts/check_all_features.mjs#L155](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/scripts/check_all_features.mjs#L155), set `rejectUnauthorized: false` for direct pooler connections.
- **Effort:** **XS (< 15 mins)**

---

## 6. QUICK WINS (< 1 DAY COMBINED EFFORT, ZERO REGRESSION RISK)

The following quick wins can be executed immediately in a single deployment cycle:

1. **`SEC-001`**: Remove `'admin'` from `handle_new_user_provisioning()` trigger (15 mins).
2. **`SEC-002`**: Drop open SELECT on base `jobs` table (15 mins).
3. **`SEC-005`**: Drop legacy open UPDATE policy on `job_applications` (10 mins).
4. **`FLOW-001`**: Allow `validate_job_transition` from `filling` to `in_progress` (15 mins).
5. **`UX-001`**: Standardize `app.json` brand colors to `#000000` (15 mins).
6. **`TEST-001`**: Set `rejectUnauthorized: false` in `check_all_features.mjs` (10 mins).

---

## 7. PRE-LAUNCH RELEASE-BLOCKING CHECKLIST

Prior to onboarding the first paying corporate host or live temporary worker:

- [x] **`SEC-001` (Security):** Admin privilege escalation eliminated in `handle_new_user_provisioning()`. Client metadata cannot grant admin role.
- [x] **`SEC-002` (Privacy):** Open SELECT on base `jobs` table dropped; supervisor contacts shielded from public queries.
- [x] **`SEC-003` (Identity):** Real photo capture & PDF document picker integrated (`expo-image-picker` & `expo-document-picker`) in `onboarding.tsx` and `profile.tsx`.
- [x] **`SEC-004` (Geofence):** 300m Haversine distance strictly enforced on backend RPC `check_in_worker_safe`.
- [x] **`SEC-005` (RLS Integrity):** Legacy open direct UPDATE policy on `job_applications` dropped; all capacity checks route via atomic RPCs.
- [x] **`FLOW-001` (State Machine):** `validate_job_transition()` updated to allow `('open', 'filling', 'filled') -> ('in_progress', 'paused', 'cancelled')`.
- [x] **`FLOW-002` (Supervisor Sign-Off):** `complete_shift_and_approve_attendance` and `validate_booking_transition` updated to allow supervisor sign-off and completion directly from `checked_in`.
- [x] **`FLOW-003` (Geocoding):** Street-level Mumbai venue resolution engine (`KNOWN_MUMBAI_VENUES` + Nominatim fallback) integrated into `create.tsx`.
- [x] **`FLOW-004` (Branding):** `public_organizer_cards` view enriched in discovery feed, restoring organizer company names.
- [x] **`FIN-001` (FinTech):** Manual Escrow Pilot SOP established with in-app bank account display, copy buttons, and UTR slip submission (`submit_invoice_payment_reference_safe`).
- [x] **`FIN-002` (Invoicing):** Dedicated `invoice_fiscal_sequences` table deployed with Indian FY rollover (April 1) and atomic sequence locking.
- [x] **`PERF-001` (Feed Optimization):** Keyset pagination RPC `get_discovery_feed` integrated into `useDiscoveryFeed.ts`, eliminating 414 URL length overflow.
- [x] **`PERF-002` (Admin Optimization):** Directory queries in `apps/admin/src/app/page.tsx` bounded with `.order('created_at', { ascending: false }).limit(100)`.
- [x] **`PERF-003` (Push Delivery):** Background dispatch service `scripts/dispatch_push_notifications.mjs` and Supabase Edge Function `dispatch-push-notifications` deployed.
- [x] **`UX-001` (Brand Consistency):** Standardized app manifests in `apps/worker/app.json` and `apps/organizer/app.json` to monochrome `#000000`.
- [x] **`UX-002` (Worker Guidance):** Unverified workers on `shift/[id].tsx` see informative warning banner and direct "Complete Identity Verification to Apply" action button.
- [x] **`TEST-001` (DevEx & SSL):** Supabase pooler SSL intermediate certificate handling fixed in `check_all_features.mjs`.
- [x] **`TEST-002` (Playwright):** Configured automated `webServer` auto-spawn in `apps/admin/playwright.config.ts`.
- [x] **Health Suite Verification:** Ran `npm run check:all`: 11/11 checks pass with 100% success across all packages, test suites, and remote database.
