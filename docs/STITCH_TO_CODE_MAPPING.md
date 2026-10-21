# STITCH SCREEN-TO-CODE MAPPING SPECIFICATION

This document maps all 28 production screens designed in the Stitch specification (`Design/`) directly to their implementation files, routes, state layers, database dependencies, security controls, and verification test cases in the Opskl codebase.

---

## Screen Mappings (1 to 28)

### 1. `worker_welcome_value_prop`
- **Intended Application**: Worker Mobile (`apps/worker`)
- **Current Route / File**: `apps/worker/app/welcome.tsx`
- **Target Route**: Registered as root gateway route in Expo Router
- **Parity Status**: Implemented and working
- **Components & Interactions**: Hero value proposition carousel, direct switch between "Find Event Work" and "Organizer Login", dynamic testimonials, terms agreement CTA.
- **Backend Dependencies**: None (Pre-auth onboarding flow)
- **Database Dependencies**: None
- **Security Requirements**: Client-side validation of terms acknowledgement before continuing.
- **Implementation Phase**: Phase 0 & Phase 3 (Worker Onboarding)
- **Test Cases & Acceptance Criteria**: `apps/worker/__tests__/app.test.ts` — Verifies welcome screen mounts, CTA navigation triggers, and route redirects if already authenticated.

---

### 2. `worker_phone_otp_verification`
- **Intended Application**: Worker Mobile (`apps/worker`)
- **Current Route / File**: `apps/worker/app/auth/login.tsx`
- **Target Route**: `/auth/login`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Indian phone (+91) input, fallback to work email, 6-digit auto-advancing OTP inputs, 45-second resend cooldown timer, terms consent checkbox.
- **Backend Dependencies**: `authService.sendOtpSafe`, `authService.verifyOtpSafe`, Supabase Auth.
- **Database Dependencies**: `auth.users`, `public.workers`
- **Security Requirements**: Rate limiting on OTP send/verify, sanitization of phone inputs, secure token storage via `expo-secure-store`.
- **Implementation Phase**: Phase 3 (Worker Authentication)
- **Test Cases & Acceptance Criteria**: `packages/validation/src/__tests__/validation.test.ts` & `src/__tests__/security_and_auth.test.ts` — Verifies 10-digit Indian mobile validation, OTP 6-digit regex, rate-limit defense.

---

### 3. `worker_profile_skills_setup`
- **Intended Application**: Worker Mobile (`apps/worker`)
- **Current Route / File**: `apps/worker/app/onboarding.tsx`
- **Target Route**: `/onboarding`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Skill category selector (Guest Relations, VIP Escort, Stage Crew, F&B Service), experience tier picker (1-3 yrs, 3-5 yrs, 5+ yrs), multi-select Mumbai locality pills (Bandra, BKC, Andheri, Lower Parel, Colaba, Powai), Western formal wear checklist.
- **Backend Dependencies**: `updateWorkerProfileSafe`
- **Database Dependencies**: `public.workers` (columns: `skills`, `experience_level`, `preferred_localities`, `attire_readiness`)
- **Security Requirements**: RLS ownership validation: only the authenticated worker can update their profile.
- **Implementation Phase**: Phase 3 (Worker Setup)
- **Test Cases & Acceptance Criteria**: `apps/worker/__tests__/phase3_worker_app.test.ts` — Verifies skills multi-selection, experience level update, and database persistence.

---

### 4. `worker_masked_kyc_verification_status`
- **Intended Application**: Worker Mobile (`apps/worker`)
- **Current Route / File**: `apps/worker/app/(tabs)/profile.tsx`
- **Target Route**: `/(tabs)/profile`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Masked Aadhaar number card (`•••• •••• 8291`), PAN document status badge, UPI bank account verification badge with penny-drop check, Document re-upload modal.
- **Backend Dependencies**: `submitVerificationDocumentSafe`, `getWorkerVerificationStatusSafe`
- **Database Dependencies**: `public.verification_documents`, `public.workers`
- **Security Requirements**: Strict PII masking: raw 12-digit Aadhaar numbers are never stored in plaintext or returned to client devices; only SHA-256 hashes and last 4 digits are accessible.
- **Implementation Phase**: Phase 3 (Worker KYC)
- **Test Cases & Acceptance Criteria**: `packages/shared/src/__tests__/verification_document_extension.test.ts` — Verifies document upload constraints, PII redaction in logs, and moderation status transitions.

---

### 5. `worker_discover_feed_shift_marketplace`
- **Intended Application**: Worker Mobile (`apps/worker`)
- **Current Route / File**: `apps/worker/app/(tabs)/index.tsx`
- **Target Route**: `/(tabs)/`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Curated shift cards, daily net wage display, venue distance badge (Haversine km calculation), uniform requirements, category filter tabs, pull-to-refresh.
- **Backend Dependencies**: `fetchOpenJobsSafe`, PostgREST realtime subscription.
- **Database Dependencies**: `public.jobs`, `public.venues`, `public.organizers`
- **Security Requirements**: Only shifts in `published` status with positive remaining capacity are queryable by workers.
- **Implementation Phase**: Phase 4 (Worker Marketplace)
- **Test Cases & Acceptance Criteria**: `src/__tests__/marketplace.test.ts` & `apps/worker/__tests__/swipe_marketplace.test.ts` — Verifies feed queries, status filtering, and distance sorting.

---

### 6. `discover_search_multi_filters`
- **Intended Application**: Worker Mobile (`apps/worker`)
- **Current Route / File**: `apps/worker/app/(tabs)/index.tsx` (Integrated Bottom Sheet)
- **Target Route**: Modal / Sheet on `/(tabs)/`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Search input with debounced keyword lookup, minimum hourly wage slider (₹150 - ₹500/hr), shift timing pills (Morning, Afternoon, Evening, Night), Mumbai locality multi-select, clear all filters CTA.
- **Backend Dependencies**: `fetchFilteredJobsSafe`
- **Database Dependencies**: `public.jobs`
- **Security Requirements**: SQL injection prevention via parameterized PostgREST operators (`gte`, `lte`, `in`).
- **Implementation Phase**: Phase 4 (Worker Discovery)
- **Test Cases & Acceptance Criteria**: `src/__tests__/marketplace.test.ts` — Verifies price range query builder, timing filter combinations, and empty-state handling.

---

### 7. `comprehensive_shift_details_briefing`
- **Intended Application**: Worker Mobile (`apps/worker`)
- **Current Route / File**: `apps/worker/app/shift/[id].tsx`
- **Target Route**: `/shift/[id]`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Shift hero with venue photo, hourly breakdown, total guaranteed payout, organizer trust rating, strict dress code specification, meal and break policy clause, organizer contact bridge.
- **Backend Dependencies**: `fetchJobByIdSafe`, `hasWorkerAppliedSafe`
- **Database Dependencies**: `public.jobs`, `public.organizers`, `public.applications`
- **Security Requirements**: Masking organizer phone number until application is confirmed; rate-limiting application attempts.
- **Implementation Phase**: Phase 4 (Shift Details)
- **Test Cases & Acceptance Criteria**: `apps/worker/__tests__/phase3_worker_app.test.ts` — Verifies shift detail loading, wage calculations, and dynamic CTA rendering based on application state.

---

### 8. `shift_application_review_truthful_status`
- **Intended Application**: Worker Mobile (`apps/worker`)
- **Current Route / File**: `apps/worker/app/shift/[id].tsx` (Status Panel)
- **Target Route**: `/shift/[id]`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Truthful application timeline (Submitted $\to$ Under Screening $\to$ Shortlisted $\to$ Confirmed), withdrawal button with cancellation reason modal, SLA countdown to organizer review.
- **Backend Dependencies**: `applyForJobSafe`, `withdrawApplicationSafe`
- **Database Dependencies**: `public.applications`
- **Security Requirements**: Truthful lifecycle: application submission never marks worker as confirmed or decrements slot capacity.
- **Implementation Phase**: Phase 4 (Application Lifecycle)
- **Test Cases & Acceptance Criteria**: `src/__tests__/marketplace.test.ts` — Verifies application creation, status constraints, and withdrawal handling.

---

### 9. `confirmed_shift_detail_day_of_briefing`
- **Intended Application**: Worker Mobile (`apps/worker`)
- **Current Route / File**: `apps/worker/app/shift/[id].tsx` (Confirmed State)
- **Target Route**: `/shift/[id]`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Day-of operational briefing, supervisor name & in-app call bridge, gate entry code, venue navigation CTA (Google Maps / Apple Maps deep link), uniform inspection reminder, check-in launch button.
- **Backend Dependencies**: `fetchBookingDetailsSafe`, `getShiftBriefingSafe`
- **Database Dependencies**: `public.bookings`, `public.jobs`, `public.venues`
- **Security Requirements**: Direct call masking via telephony bridge to prevent personal phone number harvesting.
- **Implementation Phase**: Phase 5 (Event Operations)
- **Test Cases & Acceptance Criteria**: `src/__tests__/booking_attendance.test.ts` — Verifies confirmed booking rendering, briefing access, and supervisor details retrieval.

---

### 10. `my_shifts_event_roster`
- **Intended Application**: Worker Mobile (`apps/worker`)
- **Current Route / File**: `apps/worker/app/(tabs)/my-shifts.tsx`
- **Target Route**: `/(tabs)/my-shifts`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Segmented tab control (`Upcoming`, `In Progress`, `Completed`), shift schedule cards, 2-hour worker confirmation countdown timer, action banner to launch check-in.
- **Backend Dependencies**: `fetchWorkerBookingsSafe`, `confirmWorkerBookingSafe`
- **Database Dependencies**: `public.bookings`, `public.jobs`
- **Security Requirements**: Confirmation timer expiry automatically releases the reservation back to the marketplace pool if not accepted in time.
- **Implementation Phase**: Phase 5 (Shift Management)
- **Test Cases & Acceptance Criteria**: `src/__tests__/shift_messaging_and_conflict.test.ts` — Verifies schedule conflict detection, countdown timer expiration, and booking confirmation.

---

### 11. `worker_earnings_settlement_ledger`
- **Intended Application**: Worker Mobile (`apps/worker`)
- **Current Route / File**: `apps/worker/app/(tabs)/earnings.tsx`
- **Target Route**: `/(tabs)/earnings`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Lifetime earnings card, 4-stage settlement tracking (Pending Review $\to$ Approved $\to$ Settlement Initiated $\to$ Credited), bank UTR transaction receipt modal, PDF slip download simulator.
- **Backend Dependencies**: `fetchWorkerEarningsLedgerSafe`
- **Database Dependencies**: `public.payouts`, `public.ledger_entries`
- **Security Requirements**: Strict financial ledger audit trail; immutable transaction records; no client-side payout status modifications.
- **Implementation Phase**: Phase 5 (Financials)
- **Test Cases & Acceptance Criteria**: `src/__tests__/payment_settlement.test.ts` — Verifies ledger calculations, state transitions, and UTR persistence.

---

### 12. `geofenced_check_in_attendance_qr_token`
- **Intended Application**: Worker Mobile (`apps/worker`)
- **Current Route / File**: `apps/worker/app/shift/checkin.tsx`
- **Target Route**: `/shift/checkin`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Live GPS radar with geofence proximity meter ($\le 150\text{m}$), 45-second rotating HMAC QR token, 6-digit offline fallback PIN (`884-219`), check-out toggle.
- **Backend Dependencies**: `verifyWorkerCheckInSafe`, `generateDynamicQrTokenSafe`
- **Database Dependencies**: `public.attendance_records`, `public.bookings`
- **Security Requirements**: Replay attack prevention via timestamped HMAC signatures; GPS spoofing mitigation via geofence threshold validation.
- **Implementation Phase**: Phase 5 (Attendance Verification)
- **Test Cases & Acceptance Criteria**: `src/__tests__/booking_attendance.test.ts` — Verifies distance calculation, token expiration, and check-in status updates.

---

### 13. `organizer_event_command_dashboard`
- **Intended Application**: Organizer Mobile (`apps/organizer`)
- **Current Route / File**: `apps/organizer/app/(tabs)/index.tsx`
- **Target Route**: `/(tabs)/`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Live shift health radar, venue selector dropdown (Jio World Convention Centre, Taj Lands End, Nesco), urgent action items banner, today's check-in progress bar.
- **Backend Dependencies**: `fetchOrganizerDashboardMetricsSafe`
- **Database Dependencies**: `public.jobs`, `public.bookings`, `public.attendance_records`
- **Security Requirements**: Organization tenant isolation: organizers can only view metrics for shifts owned by their organization.
- **Implementation Phase**: Phase 6 (Organizer Dashboard)
- **Test Cases & Acceptance Criteria**: `apps/organizer/__tests__/organizer_management.test.ts` — Verifies metric aggregations and tenant filtering.

---

### 14. `organizer_business_verification_kyc`
- **Intended Application**: Organizer Mobile (`apps/organizer`)
- **Current Route / File**: `apps/organizer/app/verification.tsx`
- **Target Route**: `/verification`
- **Parity Status**: Implemented and working
- **Components & Interactions**: 15-character Indian GSTIN input with checksum validation, MCA Corporate CIN number, Certificate of Incorporation document uploader, review status badge.
- **Backend Dependencies**: `submitOrganizerKycSafe`, `fetchOrganizerKycStatusSafe`
- **Database Dependencies**: `public.organizer_kyc`, `public.organizers`
- **Security Requirements**: Strict verification gates: unverified organizers cannot publish shifts to the public marketplace.
- **Implementation Phase**: Phase 6 (Organizer KYC)
- **Test Cases & Acceptance Criteria**: `packages/validation/src/__tests__/validation.test.ts` — Verifies Indian GSTIN regex and verification document requirements.

---

### 15. `organizer_shifts_management_roster`
- **Intended Application**: Organizer Mobile (`apps/organizer`)
- **Current Route / File**: `apps/organizer/app/(tabs)/roster.tsx`
- **Target Route**: `/(tabs)/roster`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Shift filter segments (`All`, `Active`, `Draft`, `Completed`), worker fill counter (`7/10 Confirmed`), action buttons to screen applicants, edit shift details, or pause hiring.
- **Backend Dependencies**: `fetchOrganizerShiftsSafe`, `updateJobStatusSafe`
- **Database Dependencies**: `public.jobs`, `public.bookings`
- **Security Requirements**: Shift state transitions must obey authorized lifecycles (e.g., cannot delete an active shift with confirmed crew).
- **Implementation Phase**: Phase 6 (Shift Management)
- **Test Cases & Acceptance Criteria**: `apps/organizer/__tests__/organizer_management.test.ts` — Verifies status segment filtering and capacity counters.

---

### 16. `multi_step_shift_creator_wage_spec`
- **Intended Application**: Organizer Mobile (`apps/organizer`)
- **Current Route / File**: `apps/organizer/app/(tabs)/create.tsx`
- **Target Route**: `/(tabs)/create`
- **Parity Status**: Implemented and working
- **Components & Interactions**: 4-step wizard with visual progress bar, Step 1 (Role & Headcount), Step 2 (Schedule & Venue), Step 3 (Wage & Transparent Escrow Breakdown), Step 4 (Requirements & Policies), Draft persistence, Submit to Moderation.
- **Backend Dependencies**: `createJobSafe`, `saveJobDraftSafe`
- **Database Dependencies**: `public.jobs`, `public.venues`
- **Security Requirements**: MMR statutory wage floor enforcement (minimum ₹150/hr); escrow total calculation consistency (Worker Net + 10% Platform Fee + 18% GST on Fee).
- **Implementation Phase**: Phase 6 (Shift Creator)
- **Test Cases & Acceptance Criteria**: `apps/organizer/__tests__/organizer_management.test.ts` & `packages/validation/src/__tests__/validation.test.ts` — Verifies 4-step validation, statutory floor checks, and escrow calculations.

---

### 17. `organizer_applicant_screening_pipeline`
- **Intended Application**: Organizer Mobile (`apps/organizer`)
- **Current Route / File**: `apps/organizer/app/shift/screening.tsx`
- **Target Route**: `/shift/screening`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Candidate cards with experience, verified badge, and rating, PII protection (masked phone & documents), 1-tap "Shortlist", "Select & Invite", or "Pass" actions, capacity limit locks.
- **Backend Dependencies**: `fetchJobApplicantsSafe`, `updateApplicationStatusSafe`, `selectWorkerForJobSafe`
- **Database Dependencies**: `public.applications`, `public.workers`, `public.jobs`
- **Security Requirements**: Selecting an applicant reserves a temporary slot with an invitation SLA; duplicate selection prevention when capacity is reached.
- **Implementation Phase**: Phase 7 (Applicant Pipeline)
- **Test Cases & Acceptance Criteria**: `apps/organizer/__tests__/organizer_management.test.ts` — Verifies selection RPC, candidate rejection, and capacity caps.

---

### 18. `confirmed_crew_roster_briefing_console`
- **Intended Application**: Organizer Mobile (`apps/organizer`)
- **Current Route / File**: `apps/organizer/app/shift/crew.tsx`
- **Target Route**: `/shift/crew`
- **Parity Status**: Implemented and working
- **Components & Interactions**: 100% confirmed crew list, emergency briefing broadcast input with instant push delivery, masked call bridge trigger, crew replacement request button.
- **Backend Dependencies**: `fetchConfirmedCrewSafe`, `broadcastBriefingSafe`
- **Database Dependencies**: `public.bookings`, `public.workers`, `public.notifications`
- **Security Requirements**: Broadcast messages are rate-limited and logged for compliance auditing.
- **Implementation Phase**: Phase 7 (Crew Console)
- **Test Cases & Acceptance Criteria**: `apps/organizer/__tests__/organizer_management.test.ts` — Verifies crew list queries and briefing broadcast dispatch.

---

### 19. `escrow_finance_invoices_settlement_ledger`
- **Intended Application**: Organizer Mobile (`apps/organizer`)
- **Current Route / File**: `apps/organizer/app/(tabs)/finances.tsx`
- **Target Route**: `/(tabs)/finances`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Total escrow deposit card, ICICI Virtual Account number for NEFT/RTGS auto-collect, line-item GST invoice generator (18% on platform fees), download tax invoice receipt.
- **Backend Dependencies**: `fetchOrganizerFinanceLedgerSafe`, `generateGstInvoiceSafe`
- **Database Dependencies**: `public.escrow_accounts`, `public.invoices`, `public.ledger_entries`
- **Security Requirements**: Strict separation of worker wage escrow (fiduciary) from platform fee revenues; tamper-proof invoice sequence numbers.
- **Implementation Phase**: Phase 7 (Finance & Escrow)
- **Test Cases & Acceptance Criteria**: `src/__tests__/escrow_flow.test.ts` — Verifies escrow balance queries, fee splits, and GST invoice calculations.

---

### 20. `live_event_check_in_attendance_console`
- **Intended Application**: Organizer Mobile (`apps/organizer`)
- **Current Route / File**: `apps/organizer/app/shift/attendance.tsx`
- **Target Route**: `/shift/attendance`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Camera viewfinder for QR code scanning, manual 6-digit PIN override modal (`884-219`), real-time attendance counter (`Checked In: 8, Pending: 2`), overtime hour approval sign-off.
- **Backend Dependencies**: `processOrganizerScanSafe`, `manualPinAttendanceSafe`
- **Database Dependencies**: `public.attendance_records`, `public.bookings`
- **Security Requirements**: Anti-fraud checks: prevents double check-ins and enforces venue geofence corroboration.
- **Implementation Phase**: Phase 7 (Event Attendance)
- **Test Cases & Acceptance Criteria**: `src/__tests__/booking_attendance.test.ts` — Verifies QR decode processing, manual PIN check-in, and attendance audit updates.

---

### 21. `admin_overview_operational_action_queues`
- **Intended Application**: Admin Web (`apps/admin`)
- **Current Route / File**: `apps/admin/src/components/AdminOverviewDesk.tsx`
- **Target Route**: `/`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Live operational dashboard, urgent action queues with SLA breach countdowns, ICICI nodal escrow health indicator, live Mumbai event radar map.
- **Backend Dependencies**: `fetchAdminOverviewMetricsSafe`
- **Database Dependencies**: `public.jobs`, `public.verification_documents`, `public.disputes`, `public.platform_settings`
- **Security Requirements**: Role-based access control (Admin role enforced on server via JWT claim).
- **Implementation Phase**: Phase 8 (Admin Desk)
- **Test Cases & Acceptance Criteria**: `apps/admin` Next.js production build (`npm run build:admin`) — Verifies server component rendering, API routes, and metric queries.

---

### 22. `worker_verification_kyc_moderation_desk`
- **Intended Application**: Admin Web (`apps/admin`)
- **Current Route / File**: `apps/admin/src/components/VerificationQueue.tsx`
- **Target Route**: `/` (Verification Tab)
- **Parity Status**: Implemented and working
- **Components & Interactions**: Dual document inspection desk (Aadhaar & PAN), penny-drop bank account verification status, 1-click Approve, Request Additional Info, or Reject with mandatory rejection rationale.
- **Backend Dependencies**: `fetchPendingVerificationsSafe`, `reviewVerificationSafe`
- **Database Dependencies**: `public.verification_documents`, `public.workers`
- **Security Requirements**: Aadhaar masking enforced on admin UI; audit log recording admin user ID and timestamp for every approval/rejection.
- **Implementation Phase**: Phase 8 (KYC Moderation)
- **Test Cases & Acceptance Criteria**: `packages/shared/src/__tests__/verification_document_extension.test.ts` — Verifies review document transition constraints and audit logging.

---

### 23. `shift_moderation_fair_wage_review_desk`
- **Intended Application**: Admin Web (`apps/admin`)
- **Current Route / File**: `apps/admin/src/components/JobModerationTable.tsx`
- **Target Route**: `/` (Moderation Tab)
- **Parity Status**: Implemented and working
- **Components & Interactions**: Shift queue table, fair wage auditor against Maharashtra statutory minimums, welfare policy checklist (Clause 4.2 meal & rest breaks), Approve listing or Flag for correction.
- **Backend Dependencies**: `fetchPendingJobsSafe`, `moderateJobSafe`
- **Database Dependencies**: `public.jobs`, `public.moderation_logs`
- **Security Requirements**: Unauthorized shifts cannot be released to worker marketplace feeds without passing admin moderation.
- **Implementation Phase**: Phase 8 (Shift Moderation)
- **Test Cases & Acceptance Criteria**: `src/__tests__/marketplace.test.ts` — Verifies moderation approval transitions and wage floor enforcement.

---

### 24. `disputes_incident_escalation_panel`
- **Intended Application**: Admin Web (`apps/admin`)
- **Current Route / File**: `apps/admin/src/components/DisputesQueue.tsx`
- **Target Route**: `/` (Disputes Tab)
- **Parity Status**: Implemented and working
- **Components & Interactions**: Escalated case review panel, telemetry corroboration feed (geofence entry times, QR scans, BLE logs), 4 binding escrow release rulings (Full Worker Payout, 50/50 Split, Full Organizer Refund, Escrow Freeze).
- **Backend Dependencies**: `fetchDisputesSafe`, `resolveDisputeSafe`
- **Database Dependencies**: `public.disputes`, `public.escrow_accounts`, `public.ledger_entries`
- **Security Requirements**: Cryptographic audit signature on dispute resolutions affecting financial escrow balances.
- **Implementation Phase**: Phase 8 (Disputes Management)
- **Test Cases & Acceptance Criteria**: `src/__tests__/escrow_flow.test.ts` — Verifies dispute resolution outcomes and escrow ledger balance re-allocations.

---

### 25. `system_notifications_operational_event_stream`
- **Intended Application**: Mobile Shared (`apps/worker` & `apps/organizer`)
- **Current Route / File**: `apps/worker/app/notifications.tsx` & `apps/organizer/app/notifications.tsx`
- **Target Route**: `/notifications`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Operational notification feed, IST chronological grouping (Today, Yesterday, Older), category filter chips (`All`, `Shift Updates`, `Escrow/Payouts`, `System Alerts`), unread indicator dots, 1-tap deep link navigation to related records.
- **Backend Dependencies**: `fetchNotificationsSafe`, `markNotificationReadSafe`
- **Database Dependencies**: `public.notifications`
- **Security Requirements**: Tenant isolation: workers only receive notifications pertinent to their bookings, organizers receive organization alerts.
- **Implementation Phase**: Phase 9 (Cross-Product Notifications)
- **Test Cases & Acceptance Criteria**: `src/__tests__/cross_product_operations.test.ts` — Verifies notification query filtering, unread state management, and deep-link routing.

---

### 26. `incident_report_ground_safety_escalation`
- **Intended Application**: Mobile Shared (`apps/worker` & `apps/organizer`)
- **Current Route / File**: `apps/worker/app/incident/report.tsx`
- **Target Route**: `/incident/report`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Ground safety incident form, 5 incident categories (Harassment, Unsafe Working Conditions, Wage Non-Payment, Overtime Coercion, Medical Emergency), 3 severity tiers, voice memo audio recorder, anonymous whistleblower identity shield checkbox.
- **Backend Dependencies**: `submitSafetyIncidentSafe`
- **Database Dependencies**: `public.incidents`, `public.disputes`
- **Security Requirements**: Whistleblower anonymity protection: reporter identity is cryptographically masked when anonymous shield is selected; immediate push alerts to Opskl Trust & Safety desk.
- **Implementation Phase**: Phase 9 (Ground Safety)
- **Test Cases & Acceptance Criteria**: `src/__tests__/cross_product_operations.test.ts` — Verifies incident validation, anonymous masking, and offline local queuing.

---

### 27. `offline_mode_local_queue_sync_hub`
- **Intended Application**: Mobile Shared (`apps/worker` & `apps/organizer`)
- **Current Route / File**: `apps/worker/app/offline.tsx`
- **Target Route**: `/offline`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Offline sync hub, local cryptographic ledger (AES-GCM-256), offline backup PIN (`884-219`), BLE mesh handshake simulation, manual "Sync Now" button, offline proof slip modal.
- **Backend Dependencies**: `offlineQueueService.enqueueSafe`, `offlineQueueService.processSyncQueueSafe`
- **Database Dependencies**: `public.offline_sync_log` (Server-side reconciliation log)
- **Security Requirements**: Client idempotency keys (`idemp-*`) prevent duplicate check-ins or duplicate incident submissions upon network restoration.
- **Implementation Phase**: Phase 9 (Offline Operations)
- **Test Cases & Acceptance Criteria**: `src/__tests__/cross_product_operations.test.ts` — Verifies offline queueing, duplicate rejection, and sync queue processing.

---

### 28. `emergency_marketplace_pause_safety_lockdown_state`
- **Intended Application**: Admin Web (`apps/admin`) & Mobile Shared
- **Current Route / File**: `apps/admin/src/components/EmergencyLockdownModal.tsx` & `apps/worker/app/emergency.tsx`
- **Target Route**: Admin Modal on `/` & Worker `/emergency`
- **Parity Status**: Implemented and working
- **Components & Interactions**: Admin platform-wide killswitch with documented rationale, affected radius selector (All Mumbai, BKC Corridor, Lower Parel), emergency broadcast banner (`#EMG-MUM-2025-08`), 100% escrow wage guarantee notice, crew safety checklist.
- **Backend Dependencies**: `systemKillswitchService.setKillswitchSafe`, `systemKillswitchService.getStatusSafe`
- **Database Dependencies**: `public.platform_settings`
- **Security Requirements**: Dual-confirmation required for administrative killswitch trigger; database-level write block on applications and job publishing while paused.
- **Implementation Phase**: Phase 9 (Emergency Controls)
- **Test Cases & Acceptance Criteria**: `src/__tests__/cross_product_operations.test.ts` — Verifies killswitch state changes, database persistence, and emergency banner visibility.
