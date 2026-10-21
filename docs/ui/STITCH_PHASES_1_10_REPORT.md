# Opskl Stitch Design-to-Code — Phases 1–10 Report

**Branch:** `feat/stitch-design-to-code-phases`  
**Date:** 2026-10-21  
**Design package:** `Design/` (28 folders, each with `screen.png` + `code.html`)

This report supersedes overclaims in `docs/FEATURE_PARITY_AUDIT.md` / `FEATURE_PARITY_TRACKER.md` where those documents asserted live ICICI VAN, HMAC QR scanners, UIDAI AUA, or “all 28 Verified” without backend proof.

---

## Phase 1 — UX / design consistency audit (findings)

### P0 — Truthfulness / fabricated live capability

| Finding | Evidence | Impact | Fix status |
| --- | --- | --- | --- |
| Admin overview fabricated venue escrow, geofence %, ICICI pool ₹18.4L | `AdminOverviewDesk.tsx` | Operators trust fake money/ops state | **Fixed** — live DB counts + ledger only |
| Worker notifications fell back to hardcoded “escrow/UTR” stream | `notifications.tsx` `DEFAULT_OPERATIONAL_STREAM` | Fake operational alerts | **Fixed** — empty when no live rows |
| Organizer finances showed ICICI VAN / RBI supervised | `finances.tsx` | Fake banking product | **Fixed** — “Funding & payment status / ledger only” |
| Shift creator claimed RBI nodal escrow hold | `create.tsx` | Fake escrow guarantee | **Fixed** — fee estimate + honest copy |
| Check-in UI presented decorative SVG as dynamic QR protocol | `GeofencedCheckInModal.tsx` | Fake scanner protocol | **Fixed** — labeled pass code / illustrative badge |
| Attendance approval copy implied auto escrow batch payout tonight | `attendance.tsx` | Attendance ≠ paid violated | **Fixed** |
| Escrow guarantee banners on organizer home / crew / disputes / lockdown | multiple | Overclaim | **Fixed** |

### P1 — Visual / IA parity (routes exist; Stitch density differs)

- Worker welcome / OTP / onboarding / discover / filters / shift detail / my-shifts / earnings: **Partial** — implemented; pixel parity vs PNG not required for truthfulness gate.
- Organizer dashboard vs “command desk”: **Partial** — list + metrics, not Stitch radar chrome.
- Admin fair-wage desk: moderation exists; statutory “engine” is rule heuristics, not MMR API.
- Offline / killswitch / incident / notifications routes: **Partial** — real services exist; Stitch BLE/AES claims not product truth.

### P2 — Design system

- Repo DS: monochrome primary + restrained accent (`packages/design-system`).
- Stitch `DESIGN.md`: Precision Blue primary — **deliberate deviation**: keep monochrome; accent only for actions/status.
- Admin uses CSS vars (not RN DS) — acceptable; keep shared semantics, not a second product DS.

### Lifecycle semantics (must remain)

Applied ≠ hired · Selected ≠ confirmed · Check-in ≠ completed · Attendance approved ≠ paid · KYC pending/rejected/approved distinct · Emergency pause only via `booking_killswitch`.

---

## Phase 2 — Design system & shells

**Status:** Complete enough — tokens, shells, and components already present. No second DS introduced. Monochrome direction preserved; blue kept as accent.

---

## Phases 3–9 — Screen groups

| Phase | Scope | Status |
| --- | --- | --- |
| 3 | Worker welcome, OTP, skills, KYC | Routes exist; honesty/KYC masking retained |
| 4 | Discover, detail, filters, apply | Routes exist; apply truthful language already present in `ApplicationReviewModal` |
| 5 | My shifts, briefing, earnings, check-in | Pass-code honesty fixed; GPS check-in via `checkInWorkerSafe` |
| 6 | Org dashboard, verification, shifts, create | Fee/funding honesty fixed |
| 7 | Screening, crew, finances, attendance | Escrow overclaim copy fixed |
| 8 | Admin overview, KYC, jobs, disputes | Fake metrics / VAN language fixed |
| 9 | Notifications, incident, offline, pause | Fake notification stream removed; killswitch/offline services remain |

---

## Phase 10 — Screen matrix (honest)

| # | Stitch folder | Route / component | Status |
| --- | --- | --- | --- |
| 1 | worker_welcome_value_prop | `welcome.tsx` | **Partial** |
| 2 | worker_phone_otp_verification | `auth/login.tsx` | **Partial** |
| 3 | worker_profile_skills_setup | `onboarding.tsx` | **Partial** |
| 4 | worker_masked_kyc_verification_status | profile / onboarding | **Partial** |
| 5 | worker_discover_feed_shift_marketplace | `(tabs)/index.tsx` | **Partial** |
| 6 | comprehensive_shift_details_briefing | `shift/[id].tsx` | **Partial** |
| 7 | discover_search_multi_filters | `FilterSheet.tsx` | **Partial** |
| 8 | shift_application_review_truthful_status | apply modals / detail | **Partial** |
| 9 | confirmed_shift_detail_day_of_briefing | `shift/[id].tsx` | **Partial** |
| 10 | my_shifts_event_roster | `my-shifts.tsx` | **Partial** |
| 11 | worker_earnings_settlement_ledger | `earnings.tsx` | **Partial** — ledger; no live bank |
| 12 | geofenced_check_in_attendance_qr_token | `GeofencedCheckInModal` | **Partial** — GPS + pass code; QR illustrative |
| 13 | organizer_event_command_dashboard | `(tabs)/index.tsx` | **Partial** |
| 14 | organizer_business_verification_kyc | `verification.tsx` | **Partial** |
| 15 | organizer_shifts_management_roster | index / roster | **Partial** |
| 16 | multi_step_shift_creator_wage_spec | `create.tsx` | **Partial** |
| 17 | organizer_applicant_screening_pipeline | screening / roster | **Partial** |
| 18 | confirmed_crew_roster_briefing_console | `crew.tsx` | **Partial** |
| 19 | escrow_finance_invoices_settlement_ledger | `finances.tsx` | **Partial** — funding status, not live escrow |
| 20 | live_event_check_in_attendance_console | `attendance.tsx` | **Partial** |
| 21 | admin_overview_operational_action_queues | `AdminOverviewDesk` | **Partial** |
| 22 | worker_verification_kyc_moderation_desk | `VerificationQueue` | **Partial** |
| 23 | shift_moderation_fair_wage_review_desk | `JobModerationTable` | **Partial** |
| 24 | disputes_incident_escalation_panel | `DisputesQueue` | **Partial** |
| 25 | system_notifications_operational_event_stream | notifications screens | **Partial** |
| 26 | incident_report_ground_safety_escalation | `incident/report.tsx` | **Partial** |
| 27 | offline_mode_local_queue_sync_hub | `offline.tsx` + queue service | **Partial** |
| 28 | emergency_marketplace_pause_safety_lockdown_state | `EmergencyLockdownModal` + killswitch | **Partial** |

**None Missing.** None Complete as pixel-perfect Stitch clones with full banking/UIDAI.  
**Blocked externally:** live SMS OTP gateway, UIDAI AUA, ICICI/RazorpayX nodal VAN, physical BLE mesh.

---

## Validation commands (re-run after this work)

```bash
npm run typecheck
npm test
npm run build:admin
```

Do **not** call the product production-ready solely because it compiles.
