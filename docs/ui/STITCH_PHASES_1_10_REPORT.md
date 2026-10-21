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
| Admin queue rows invented SLA timers, assignees, hub locations | `AdminOverviewDesk.tsx` | Fake ops urgency | **Fixed** (follow-up) — real timestamps / QUEUE only |
| Admin “98.4% SLA” horizon chart | `AdminOverviewDesk.tsx` | Fake telemetry | **Fixed** (follow-up) — live queue counts |
| Organizer welcome optical QR / escrow settlement claims | `welcome.tsx` | Overclaim | **Fixed** (follow-up) |
| Offline BLE mesh / AES / crypto voucher demo | `offline.tsx` | Fake hardware capability | **Fixed** (follow-up) — unavailable + local queue only |
| Emergency pause “nodal escrow assured” | `emergency.tsx` | Fake bank guarantee | **Fixed** (follow-up) |
| Organizer dashboard `98.4%` / `\|\| 38` metrics | `index.tsx` | Fake KPIs | **Fixed** (follow-up) — live metrics |
| Verification desk OCR / penny-drop / K. Sharma | `VerificationQueue.tsx` | Fake ops tooling | **Fixed** (follow-up) |
| Disputes turnstile 98.4% telemetry | `DisputesQueue.tsx` | Fake sensors | **Fixed** (follow-up) |
| Fake BKC/venue phone desks (`+91 22 4910 8800`, 24/7) | incident / emergency / my-shifts / earnings / onboarding | Fake ops hotline | **Fixed** (follow-up 2) — 112 + email only |
| Earnings IMPS gateway + HDFC •••4018 demo | `earnings.tsx` | Fake bank product | **Fixed** (follow-up 2) — ledger / UPI on file |
| Discover OCR 80% + Instant UPI + fake KYC ref | `index.tsx` | Fake KYC/OCR | **Fixed** (follow-up 2) |
| Verification desk OCR 100% / NPCI / fabricated DOB table | `VerificationQueue.tsx` | Fake tooling | **Fixed** (follow-up 2) — manual checklist |
| Biometric / turnstile / auto-disbursement copy | crew / attendance / shift detail / welcome | Overclaim | **Fixed** (follow-up 2) |
| Fair-wage “Engine v3.1” badge | `JobModerationTable.tsx` | Fake statutory engine | **Fixed** (follow-up 2) — heuristics label |
| Instant UPI / Guaranteed / 24h payout marketing | discover, SwipeCard, FilterSheet, check-in, shift detail | Fake settlement product | **Fixed** (follow-up 3) |
| Instant Mumbai Escrow CTA | organizer `index.tsx` | Fake escrow | **Fixed** (follow-up 3) |
| Disputes Aarav/JWCC/BLE telemetry demo dossier | `DisputesQueue.tsx` | Fabricated case narrative | **Fixed** (follow-up 3) — live dispute fields |
| Verification invented SLA wait timers | `VerificationQueue.tsx` | Fake ops urgency | **Fixed** (follow-up 3) — real `createdAt` |
| Demo Aarav/Priya crew, attendance, screening rosters | organizer shift screens | Always-on fake people | **Fixed** (follow-up 4) — empty until live rows |
| Empty finances showing INV-2025 demo GST/UTR cards | `finances.tsx` | Fake invoices | **Fixed** (follow-up 4) — honest empty state |
| Dashboard FinTech / 6·6 / Rohit phone / `\|\| 4` metrics | organizer `index.tsx` | Fake live venue | **Fixed** (follow-up 4) |
| Masked “Opskl Bridge Call” / Rohit Mehta defaults | worker `shift/[id].tsx` | Fake telephony | **Fixed** (follow-up 4) |
| Fake WhatsApp OTP / Business API dispatch | worker `auth/login.tsx` | Fake OTP channel | **Fixed** (follow-up 5) |
| JWCC Gate 4 / Vibez Ent dispute chrome when empty | `AdminOverviewDesk.tsx` | Fake escalation | **Fixed** (follow-up 5) |
| Apex/Rohit/GSTIN prefilled verification form | organizer `verification.tsx` | Demo identity | **Fixed** (follow-up 5) — empty until profile load |
| Incident demo Unsplash photo + voice memo | `incident/report.tsx` | Fake evidence | **Fixed** (follow-up 5) |
| WhatsApp offer / nudge / preference claims | screening, roster, notifications | Fake messaging | **Fixed** (follow-up 5) |
| Fake ₹15k escrow pool on attendance | `attendance.tsx` | Fake bank hold | **Fixed** (follow-up 5) |
| Fabricated Audit Governance bot feed | `AdminOverviewDesk.tsx` | Fake Kavita/Vibez/batch rows | **Fixed** (follow-up 5b) — live KYC/dispute snippets |
| Incident “Attach Photos” added Unsplash demo | `incident/report.tsx` | Fake evidence | **Fixed** (follow-up 5b) → later wired to ImagePicker |
| Organizer crew / attendance / screening empty shells | shift consoles | Features looked dead after demo purge | **Wired** — `fetchJobBookings` / `fetchApplicationsForJob` + cancel/confirm/check-in/no-show/sign-off RPCs |
| Crew muster / briefing / standby | `crew.tsx` | Simulated swap | **Wired** — Share muster, `sendShiftMessage`, cancel+confirm replacement from reserve applicants |
| Incident evidence + submit IDs | `incident/report.tsx` | Dummy shift/venue/case refs | **Wired** — real session + ImagePicker URIs + optional route params |
| Admin Audit Governance | `AdminOverviewDesk` | Fake bot rows | **Wired** — live `auditLogs` from admin page |

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
