# SCREEN_AND_ROUTE_INVENTORY

**Commit:** `169451cd1d58dbf68ae1e635347c84ba96174545`  
**Method:** Independent filesystem inspection of `Design/*` + Expo Router / Next routes.  
**Runtime reachability:** **NOT RUN** on device/browser unless noted. Route *existence* from source only.

## Design package inventory

| # | Stitch folder | `screen.png` | `code.html` | Mapped app route / component | Source file(s) | Reachable (source) | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `worker_welcome_value_prop` | yes | yes | Worker `/welcome` | `apps/worker/app/welcome.tsx` | Route file exists | **PARTIAL** — UI present; live metrics not proven |
| 2 | `worker_phone_otp_verification` | yes | yes | Worker `/auth/login` | `apps/worker/app/auth/login.tsx` | Route file exists | **PARTIAL** — OTP via Supabase phone; WhatsApp OTP marked unavailable in UI |
| 3 | `worker_profile_skills_setup` | yes | yes | Worker `/onboarding` | `apps/worker/app/onboarding.tsx` | Route file exists | **PARTIAL** — uses ImagePicker/DocumentPicker + verification upload paths |
| 4 | `worker_masked_kyc_verification_status` | yes | yes | Profile / onboarding KYC | `apps/worker/app/(tabs)/profile.tsx`, onboarding | Exists | **PARTIAL** — masked display; no live UIDAI |
| 5 | `worker_discover_feed_shift_marketplace` | yes | yes | Worker `/(tabs)/` | `apps/worker/app/(tabs)/index.tsx` + `SwipeCard` / `useDiscoveryFeed` | Exists | **PARTIAL** — feed RPC exists; live data **BLOCKED** without DB |
| 6 | `comprehensive_shift_details_briefing` | yes | yes | Worker `/shift/[id]` | `apps/worker/app/shift/[id].tsx` | Exists | **PARTIAL** |
| 7 | `discover_search_multi_filters` | yes | yes | Filter sheet | `apps/worker/src/components/FilterSheet.tsx` | Component exists | **PARTIAL** — options UI; live filter efficacy **NOT RUN** |
| 8 | `shift_application_review_truthful_status` | yes | yes | Apply modal | `apps/worker/src/components/ApplicationReviewModal.tsx` | Exists | **PARTIAL** |
| 9 | `confirmed_shift_detail_day_of_briefing` | yes | yes | Same `/shift/[id]` booked branch | `apps/worker/app/shift/[id].tsx` | Exists | **PARTIAL** |
| 10 | `my_shifts_event_roster` | yes | yes | Worker `/(tabs)/my-shifts` | `apps/worker/app/(tabs)/my-shifts.tsx` | Exists | **PARTIAL** |
| 11 | `worker_earnings_settlement_ledger` | yes | yes | Worker `/(tabs)/earnings` | `apps/worker/app/(tabs)/earnings.tsx` | Exists | **PARTIAL** — ledger UI; live bank **not** integrated |
| 12 | `geofenced_check_in_attendance_qr_token` | yes | yes | Check-in modal / route | `GeofencedCheckInModal.tsx`, `shift/checkin.tsx` | Exists | **PARTIAL** — GPS + pass code; QR illustrative |
| 13 | `organizer_event_command_dashboard` | yes | yes | Organizer `/(tabs)/` | `apps/organizer/app/(tabs)/index.tsx` | Exists | **PARTIAL** |
| 14 | `organizer_business_verification_kyc` | yes | yes | `/verification` | `apps/organizer/app/verification.tsx` | Exists | **PARTIAL** |
| 15 | `organizer_shifts_management_roster` | yes | yes | `/(tabs)/roster` | `apps/organizer/app/(tabs)/roster.tsx` | Exists | **PARTIAL** |
| 16 | `multi_step_shift_creator_wage_spec` | yes | yes | `/(tabs)/create` | `apps/organizer/app/(tabs)/create.tsx` | Exists | **PARTIAL** — wizard UI; publish needs live RPC |
| 17 | `organizer_applicant_screening_pipeline` | yes | yes | `/shift/screening` | `apps/organizer/app/shift/screening.tsx` | Exists | **PARTIAL** — wired to `fetchApplicationsForJob` (source) |
| 18 | `confirmed_crew_roster_briefing_console` | yes | yes | `/shift/crew` | `apps/organizer/app/shift/crew.tsx` | Exists | **PARTIAL** — wired to `fetchJobBookings` (source) |
| 19 | `escrow_finance_invoices_settlement_ledger` | yes | yes | `/(tabs)/finances` | `apps/organizer/app/(tabs)/finances.tsx` | Exists | **PARTIAL** — funding/ledger language; no live nodal escrow |
| 20 | `live_event_check_in_attendance_console` | yes | yes | `/shift/attendance` | `apps/organizer/app/shift/attendance.tsx` | Exists | **PARTIAL** — bookings-backed (source) |
| 21 | `admin_overview_operational_action_queues` | yes | yes | Admin `/` overview module | `AdminOverviewDesk.tsx` + `page.tsx` | Exists | **PARTIAL** |
| 22 | `worker_verification_kyc_moderation_desk` | yes | yes | Admin verifications module | `VerificationQueue.tsx` | Exists | **PARTIAL** — OCR not connected |
| 23 | `shift_moderation_fair_wage_review_desk` | yes | yes | Admin moderation | `JobModerationTable.tsx` | Exists | **PARTIAL** — heuristics, not statutory API |
| 24 | `disputes_incident_escalation_panel` | yes | yes | Admin disputes | `DisputesQueue.tsx` | Exists | **PARTIAL** |
| 25 | `system_notifications_operational_event_stream` | yes | yes | Worker/Org `/notifications` | `apps/*/app/notifications.tsx` | Exists | **PARTIAL** — prefs exist; push delivery **BLOCKED** without FCM/APNs proof |
| 26 | `incident_report_ground_safety_escalation` | yes | yes | Worker `/incident/report` | `apps/worker/app/incident/report.tsx` | Exists | **PARTIAL** — submit service + ImagePicker (source) |
| 27 | `offline_mode_local_queue_sync_hub` | yes | yes | Worker `/offline` | `apps/worker/app/offline.tsx` + offline queue service | Exists | **PARTIAL** — BLE mesh not implemented |
| 28 | `emergency_marketplace_pause_safety_lockdown_state` | yes | yes | Worker `/emergency` + admin modal | `emergency.tsx`, `EmergencyLockdownModal.tsx` | Exists | **PARTIAL** — killswitch RPC exists in shared; live pause **NOT RUN** |

### Non-screen Design assets

| Asset | Notes |
| --- | --- |
| `Design/opskl_design_system/DESIGN.md` | Stitch DS (Precision Blue); repo DS is monochrome — documented deviation |
| `Design/opskl_architecture_state_matrix.md` | Lifecycle matrix |
| `Design/opskl_stitch_phase_by_phase_screen_design_prompts.md` | Phase prompts |
| `Design/opskl_phase_8_final_prototype_audit.md` | Prior Stitch audit — **not** used as PASS evidence |

## Additional implemented routes (not 1:1 Stitch folders)

| App | Route | File | Notes |
| --- | --- | --- | --- |
| Worker | `/(tabs)/profile` | `profile.tsx` | Profile/KYC |
| Worker | `/shift/checkin` | `checkin.tsx` | Check-in host |
| Organizer | `/welcome`, `/auth/login`, `/(tabs)/profile` | respective | Auth/shell |
| Organizer | `/shift/[id]` | `shift/[id].tsx` | Shift detail |
| Admin | `/login` | `login/page.tsx` | Auth |
| Admin | `/api/auth/register-organizer` | API route | Build lists route |

## Selection controls (inventory — behavioral verification status)

| Control surface | Options source | Every option exercised live? | Status |
| --- | --- | --- | --- |
| Worker FilterSheet wage/locality/role/amenities | Local UI state | **NOT RUN** | PARTIAL |
| Worker apply confirmation | Job fields | **NOT RUN** | PARTIAL |
| Organizer create wizard pay basis / amenities | Local form state | **NOT RUN** | PARTIAL |
| Screening tabs (applied/shortlisted/…) | Application status mapping | **NOT RUN** live | PARTIAL (unit/source only) |
| Admin queue filters | Client filter state | **NOT RUN** | PARTIAL |
| Incident category/severity | Local enums | **NOT RUN** submit live | PARTIAL |

**Rule applied:** visible options without fresh interaction evidence remain **PARTIAL / NOT RUN**, never PASS.
