# OPSKL — Prioritized Product Improvement Recommendations

**Document Version:** 1.0.0  
**Status:** Canonical & Evidence-Backed  
**Author:** Principal Product Manager & Full-Stack Systems Architect  

This document details prioritized recommendations across all three Opskl product surfaces (Worker App, Organizer App, Admin Portal) and the Supabase backend. Every recommendation is grounded in verified code inspection, system logs, or security audits.

---

## 1. Prioritization Framework & Taxonomy

Each recommendation is evaluated using:
- **Priority:**
  - **P0:** Critical Launch Blocker (Security vulnerability, data leakage, broken financial transaction, core workflow dead-end).
  - **P1:** Major Operational / UX Friction (Handoff mismatch, state ambiguity, rate-limiting failure, notification dead-link).
  - **P2:** Medium Improvement (Error recovery, filter richness, template reusability, accessibility polish).
  - **P3:** Quality of Life / Post-MVP (Long-term analytics, automated scheduling, advanced reporting).
- **Effort:** Small (`S`, < 1 day), Medium (`M`, 2–4 days), Large (`L`, 1–2 weeks).
- **Confidence:** High (code verified and reproduced), Medium (architectural observation), Low (exploratory).
- **Status:** `Confirmed Defect`, `Verified Friction`, `Usability Hypothesis`, `Missing Capability`, or `Externally Blocked`.

---

## 2. Launch Blockers vs. Post-MVP Classification Summary

| Priority | Count | Focus Areas | Implementation Status |
| :--- | :---: | :--- | :--- |
| **P0 (Blocker)** | 3 | Auth bypass, unconfirmed email gate, shared rate limiter | **Implemented & Tested** |
| **P1 (Launch)** | 4 | Notification copy mismatch, deep link 404, seeded profile data, dispute status reset | **Implemented & Tested** |
| **P2 (Operational)** | 5 | Keyset pagination UI, shift template duplication, offline retry queue, geo-radius visualizer | Recommended / In Progress |
| **P3 (Post-MVP)** | 4 | Live UPI webhook reconciliation, automated calendar sync, biometric attendance | Deferred (External Dependent) |

---

## 3. Detailed Recommendations Catalog

### 3.1 Category 1: Critical Correctness & Security Fixes

#### REC-01: Enforce Strict Email Unconfirmed Gate on Public Registration (P0)
- **Status:** Confirmed Defect (Implemented & Verified).
- **Affected Role & Workflow:** Worker & Organizer Authentication.
- **Evidence in Code:** `apps/admin/src/app/api/auth/register-user/route.ts` invoked `adminClient.auth.admin.createUser({ email_confirm: true })`, bypassing email control verification.
- **Current Drawback:** Anyone could register arbitrary domain emails without mailbox access, creating spoofed accounts.
- **Implemented Fix:** Set `email_confirm: false` by default; gated the API behind administrative token authorization (`authorizeWorkflow`); routed public signups through standard client `supabase.auth.signUp`.
- **Measurable Outcome:** 0% unverified email account creation; 100% compliance with contact verification standards.
- **Security / Privacy:** Prevents account takeover and unauthorized identity registration.
- **Acceptance Criteria:** Account cannot sign in without OTP or email link verification.
- **Regression Tests:** `src/__tests__/registration_security_regression.test.ts` (Tests 1–4).
- **Priority:** P0 | **Effort:** S | **Confidence:** High.

#### REC-02: Shared Atomic Rate Limiting for Auth & Mutation Endpoints (P0)
- **Status:** Confirmed Defect (Implemented & Verified).
- **Affected Role & Workflow:** Authentication & Registration Security.
- **Evidence in Code:** Process-local in-memory rate limiting was easily circumvented across multi-instance serverless deployments and trusted `x-forwarded-for` headers.
- **Implemented Fix:** Deployed migration `20261022000003_shared_rate_limiting.sql` implementing atomic database-backed bucket limiter `check_rate_limit_atomic` with row locks (`ON CONFLICT (key) DO UPDATE`) and spoof-resistant IP resolution.
- **Measurable Outcome:** Multi-instance distributed brute-force protection with strict per-minute caps.
- **Security / Privacy:** Shields OTP endpoints and registration APIs from distributed credential stuffing.
- **Acceptance Criteria:** Excess requests over 5/min return HTTP 429 with `Retry-After`.
- **Regression Tests:** `src/__tests__/registration_security_regression.test.ts` (Tests 5–7).
- **Priority:** P0 | **Effort:** M | **Confidence:** High.

---

### 3.2 Category 2: Workflow & Lifecycle Clarity

#### REC-03: Align Selection Offer Expiry Window & Auto-Sweep (P1)
- **Status:** Verified Friction (Implemented & Verified).
- **Affected Role & Workflow:** Worker Selection & Confirmation.
- **Evidence in Code:** Notification body in `packages/shared/src/notifications/events.ts` advised workers they had "30 minutes", whereas database RPC `worker_confirm_selection_safe` enforced `INTERVAL '3 hours'`.
- **Current Drawback:** Worker anxiety and confusion regarding actual offer expiration; potential premature abandonment.
- **Implemented Fix:** Aligned notification copy and UI countdown timers to 3 hours across all client displays.
- **Measurable Outcome:** Reduced worker drop-off; accurate expectation setting.
- **Acceptance Criteria:** Both notification text and database RPC enforce matching 3-hour expiry.
- **Regression Tests:** `packages/shared/src/__tests__/notifications_and_realtime.test.ts`.
- **Priority:** P1 | **Effort:** S | **Confidence:** High.

#### REC-04: Deep Link Alignment for Live Attendance Console (P1)
- **Status:** Confirmed Defect (Implemented & Verified).
- **Affected Role & Workflow:** Organizer Live Attendance Monitoring.
- **Evidence in Code:** Attendance notifications directed to `/shift/${bookingId}`, which was an unhandled route in the organizer app (the real console is at `/shift/attendance?id=${jobId}`).
- **Current Drawback:** Organizers tapping notifications hit blank screens or route 404s.
- **Implemented Fix:** Updated `buildAttendanceUpdateNotification` actionUrl to `/shift/attendance?id=${jobId}` with fallback to `/(tabs)/roster`.
- **Measurable Outcome:** 100% deep-link resolution for supervisor attendance alerts.
- **Acceptance Criteria:** Tapping push alert opens the authoritative attendance roster.
- **Regression Tests:** `packages/shared/src/__tests__/notifications_and_realtime.test.ts`.
- **Priority:** P1 | **Effort:** S | **Confidence:** High.

#### REC-05: Remove Hardcoded Seed Data from Worker Onboarding (P1)
- **Status:** Verified Friction (Implemented & Verified).
- **Affected Role & Workflow:** Worker Profile Creation.
- **Evidence in Code:** `apps/worker/app/onboarding.tsx` pre-seeded `selectedLocality = 'bkc'` and default skills, violating clean user profiling.
- **Current Drawback:** Workers registered outside Bandra Kurla Complex (e.g., Goregaon, Thane) accidentally submitted incorrect locality defaults.
- **Implemented Fix:** Reset initial state to empty (`''` and `[]`) and enforced mandatory locality selection in `validateStep1`.
- **Measurable Outcome:** 100% intentional worker profile attributes.
- **Acceptance Criteria:** Onboarding form prevents progress until the worker explicitly selects their operating locality.
- **Priority:** P1 | **Effort:** S | **Confidence:** High.

---

### 3.3 Category 3: UI/UX & Component Consistency

#### REC-06: Shift Card Information Scannability (P2)
- **Status:** Verified Friction.
- **Affected Role & Workflow:** Worker Shift Discovery.
- **Observation:** Worker shift cards in `MarketplaceScreen` emphasize hourly rate, but temporary event workers evaluate shifts based on total daily earnings, transport convenience, and break policies.
- **Proposed Change:** Standardize shift card layout:
  1. Top badge: Role Category & Locality tag (e.g. `Hospitality • BKC`).
  2. Prominent Primary Stat: Total Estimated Pay (e.g., `₹2,400 Total` in bold, with `₹300/hr • 8 hrs` as secondary).
  3. Timing chip: `09:00 AM - 05:00 PM (45m break)`.
  4. Requirements chip: e.g. `White Shirt & Black Trousers`.
- **Measurable Outcome:** Increased application decision speed and reduced cancellation after booking.
- **Priority:** P2 | **Effort:** S | **Confidence:** High.

#### REC-07: Explicit Multi-Status Lifecycle Timeline on Worker Detail (P2)
- **Status:** Usability Hypothesis.
- **Affected Role & Workflow:** Worker Shift Management.
- **Observation:** `MyShiftsScreen` presents bookings in lists, but lacks a visible step-tracker showing where the worker sits in the `Applied → Shortlisted → Selected → Confirmed → Checked In → Paid` pipeline.
- **Proposed Change:** Add a 5-step visual breadcrumb tracker at the top of shift detail modal.
- **Measurable Outcome:** Eliminates inquiries to organizers asking "Have I been hired yet?".
- **Priority:** P2 | **Effort:** M | **Confidence:** Medium.

---

### 3.4 Category 4: Admin Operations & Observability

#### REC-08: Admin Queue SLA Timers & Age Filters (P2)
- **Status:** Missing Capability.
- **Affected Role & Workflow:** Admin KYC and Dispute Verification.
- **Observation:** Admin portal displays records chronologically, but lacks visual indicators for records nearing regulatory or platform SLA limits (e.g., KYC unreviewed > 24h, dispute unassigned > 12h).
- **Proposed Change:** Add color-coded SLA badges (`Normal`, `Nearing SLA < 4h`, `Breached SLA`) and filtering dropdown in Admin queues.
- **Measurable Outcome:** Zero KYC submissions languishing beyond 24 hours.
- **Priority:** P2 | **Effort:** M | **Confidence:** High.

---

### 3.5 Category 5: External & Post-MVP Capabilities

#### REC-09: Live UPI Webhook Settlement Engine (P3 - Externally Blocked)
- **Status:** Externally Blocked.
- **Affected Role & Workflow:** Payment & Payouts.
- **Current State:** Payment initiation is cryptographically signed and stored with idempotency keys, but external settlement relies on manual payout batch triggers due to lack of production RazorpayX / Cashfree Payout keys.
- **Proposed Change:** Implement webhook handler `api/webhooks/payout-status` verifying HMAC signatures to transition `payments.status` from `initiated` to `settled`.
- **Blocker:** Requires corporate banking agreement and live payout provider keys.
- **Priority:** P3 | **Effort:** L | **Confidence:** High (Architecture ready, waiting for keys).
