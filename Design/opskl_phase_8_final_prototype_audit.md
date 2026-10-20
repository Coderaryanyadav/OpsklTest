# OPSKL — Phase 8 Final Prototype Integration & Screen Completeness Audit

## Executive Summary
Opskl is a specialized event staffing operations platform designed for high-density, multi-venue operations in Mumbai (Jio World Convention Centre BKC, NESCO Goregaon, Dome SVP Stadium Worli). Over Phases 0 through 7, a comprehensive system of **28 high-fidelity production screens** across three distinct roles (**Worker Mobile App**, **Organizer Mobile App**, and **Admin Web Console**) was established and anchored by the **Opskl Design System (Plus Jakarta Sans, Monochromatic Slate + Precision Blue `#0F52BA`)**.

This document serves as the formal **Phase 8 Prototype Integration, Cross-Flow Verification, Truthful State Governance, and Engineering Handoff Audit**.

---

## 1. Complete Screen & Artifact Inventory (28 Screens)

### A. Worker Mobile Experience (12 Screens)
1. **{{DATA:SCREEN:SCREEN_56}} — Worker Welcome & Value Prop**
   - *Flow*: Entry / Onboarding
   - *Key Mechanisms*: Value pillars (Zero worker deductions, RBI-supervised nodal escrow guarantee, Mumbai event accreditation), phone input entry trigger, terms agreement.
2. **{{DATA:SCREEN:SCREEN_54}} — Worker Phone & OTP Verification**
   - *Flow*: Authentication & Session
   - *Key Mechanisms*: 6-digit OTP entry, 45-second resend countdown timer, auto-paste support, masked destination `+91 98201 •••••`, error/rate-limit recovery path.
3. **{{DATA:SCREEN:SCREEN_52}} — Worker Profile & Skills Setup**
   - *Flow*: Worker Profile & Onboarding
   - *Key Mechanisms*: Multi-select skill badges (VIP Concierge, AV Runner, F&B Service, Delegate Registration), Mumbai locality cluster selection (BKC, Goregaon, Lower Parel), Western Formal attire inventory.
4. **{{DATA:SCREEN:SCREEN_50}} — Worker Masked KYC & Verification Status**
   - *Flow*: Compliance & Identity
   - *Key Mechanisms*: Masked Aadhaar (`•••• •••• 8291`) and PAN upload, live status banner (*Under Admin Review*), UIDAI data vault assurance, restricted bidding lock notice.
5. **{{DATA:SCREEN:SCREEN_48}} — Worker Discover Feed & Shift Marketplace**
   - *Flow*: Shift Discovery
   - *Key Mechanisms*: Persistent top app bar & tab navigation, Mumbai venue cluster filters, scannable shift cards with transparent wage basis (`₹2,400 / shift` & `₹266/hr`), reporting times in IST, confirmed vs applied status indicators.
6. **{{DATA:SCREEN:SCREEN_44}} — Discover Search & Multi-Filters**
   - *Flow*: Shift Search & Filter
   - *Key Mechanisms*: Pay basis toggle (Hourly vs Fixed), role classification, locality distance radius (<5km, <15km), dress code filter, reset filters trigger.
7. **{{DATA:SCREEN:SCREEN_46}} — Comprehensive Shift Details & Briefing**
   - *Flow*: Shift Inspection
   - *Key Mechanisms*: Detailed role duties, reporting gate instructions, organizer trust score (*Apex Live Experiences, GST Verified*), dress code requirements, transit advisories, explicit Apply action.
8. **{{DATA:SCREEN:SCREEN_42}} — Shift Application Review & Truthful Status**
   - *Flow*: Application Submission
   - *Key Mechanisms*: Pre-submission checklist, truthful status badge (*Application Submitted • Under Screening*), disclaimer stating that applying is not hiring.
9. **{{DATA:SCREEN:SCREEN_38}} — My Shifts & Event Roster**
   - *Flow*: Roster Management
   - *Key Mechanisms*: Tabs for *Upcoming (2)*, *Needs Action (1)*, and *In Progress (0)*; countdown timers for shortlisted offers (`02h 15m remaining to confirm spot`).
10. **{{DATA:SCREEN:SCREEN_40}} — Confirmed Shift Detail & Day-of Briefing**
    - *Flow*: Day-of Shift Operations
    - *Key Mechanisms*: Locked roster identifier `#SHF-BOM-7729`, live reporting countdown, interactive venue directions to Gate 4 Turnstiles, attire confirmation checklist, on-site coordinator call bridge.
11. **{{DATA:SCREEN:SCREEN_34}} — Geofenced Check-In & Attendance QR Token**
    - *Flow*: Attendance & Verification
    - *Key Mechanisms*: Real-time geofence validation (`±4m accuracy`), 45-second dynamic refreshing QR pass, 6-digit backup attendance PIN (`884 - 219`), 4-stage operational checkpoint progress.
12. **{{DATA:SCREEN:SCREEN_36}} — Worker Earnings & Settlement Ledger**
    - *Flow*: Financials & Settlement
    - *Key Mechanisms*: Strict 4-stage pipeline (*1. Disbursed/Settled, 2. Approved Tonight 23:00 IST, 3. Under Review, 4. Projected*), bank UTR tracking, zero worker fee guarantee, PDF pay slip download.

---

### B. Organizer Mobile Experience (8 Screens)
1. **{{DATA:SCREEN:SCREEN_30}} — Organizer Business Verification & KYC**
   - *Flow*: Organizer Compliance
   - *Key Mechanisms*: Corporate legal entity profile (*Apex Live Experiences Pvt Ltd*), GSTIN input with status (*Document Submitted • Pending Admin Review*), CIN certificate verification, authorized signatory KYC, venue security clearances (JWCC & NESCO).
2. **{{DATA:SCREEN:SCREEN_32}} — Organizer Event Command & Dashboard**
   - *Flow*: Command & Operational Overview
   - *Key Mechanisms*: Venue selector (BKC / NESCO / Worli), urgent action alerts (worker confirmation timeouts), live venue attendance snapshot (6/6 checked in), quick command desk.
3. **{{DATA:SCREEN:SCREEN_26}} — Multi-Step Shift Creator & Wage Spec**
   - *Flow*: Shift Creation Wizard
   - *Key Mechanisms*: 4-step wizard, wage basis calculator (per shift vs hourly), statutory welfare selection (catered meals, AC lounge, RFID pass), auditable escrow breakdown (Wage + 10% Platform Fee + 18% GST).
4. **{{DATA:SCREEN:SCREEN_28}} — Organizer Shifts Management Roster**
   - *Flow*: Shift Lifecycle Management
   - *Key Mechanisms*: Segmented filters (*All, Active & Open, Roster Locked, Drafts, Completed*), applicant pipeline progress bars, quick triggers for broadcasting briefings.
5. **{{DATA:SCREEN:SCREEN_24}} — Organizer Applicant Screening & Pipeline**
   - *Flow*: Candidate Evaluation
   - *Key Mechanisms*: Funnel tabs (*Applied, Shortlisted, Selected*), privacy-safe applicant cards (rating, Mumbai experience, language, Western formal readiness), Select & Send Offer action with explicit "Awaiting Worker Confirmation" banner.
6. **{{DATA:SCREEN:SCREEN_22}} — Confirmed Crew Roster & Briefing Console**
   - *Flow*: Crew Management & Briefing
   - *Key Mechanisms*: 100% locked 6/6 crew roster, one-tap digital briefing broadcast with acknowledgement tracker, emergency standby crew pool within 5km, call bridge.
7. **{{DATA:SCREEN:SCREEN_18}} — Live Event Check-In & Attendance Console**
   - *Flow*: Event-Day Attendance Gate
   - *Key Mechanisms*: Attendance roll (5 present, 1 en-route, 0 no-show), optical QR camera scanner, manual PIN entry fallback, billable overtime adjustments, timesheet sign-off.
8. **{{DATA:SCREEN:SCREEN_20}} — Escrow Finance, Invoices & Settlement Ledger**
   - *Flow*: Enterprise Finance
   - *Key Mechanisms*: ICICI Nodal Virtual Account (VAN) tracking, ₹1,84,500 active pool breakdown, zero worker deduction guarantee, downloadable GST tax invoices with SAC codes.

---

### C. Admin Web Console (4 Screens)
1. **{{DATA:SCREEN:SCREEN_16}} — Admin Overview & Operational Action Queues**
   - *Flow*: Desktop Operations Hub
   - *Key Mechanisms*: Persistent navigation sidebar, SLA breach warning banners (<35m remaining), 18 active live shifts radar, ICICI nodal escrow balance monitor, superadmin emergency marketplace pause trigger.
2. **{{DATA:SCREEN:SCREEN_14}} — Worker Verification (KYC) Moderation Desk**
   - *Flow*: Worker Identity Adjudication
   - *Key Mechanisms*: Prioritized queue with SLA timers, side-by-side OCR vs candidate self-declaration audit, masked Aadhaar document preview, penny-drop UPI verification log, formal approve/reject actions.
3. **{{DATA:SCREEN:SCREEN_12}} — Shift Moderation & Fair Wage Review Desk**
   - *Flow*: Statutory & Wage Governance
   - *Key Mechanisms*: MMR wage floor compliance engine (flags shifts below ₹1,600 / 8h benchmark), meal & welfare clause validation, one-tap statutory revision enforcement.
4. **{{DATA:SCREEN:SCREEN_10}} — Disputes & Incident Escalation Panel**
   - *Flow*: Escalation & Resolution
   - *Key Mechanisms*: Dual worker/organizer statement adjudication, automated telemetry sensor corroboration (geofence pings, BLE beacon logs, offline PIN verification), binding escrow release authorization.

---

### D. Cross-Product Resilience, Safety & Offline States (4 Screens)
1. **{{DATA:SCREEN:SCREEN_8}} — System Notifications & Operational Event Stream**
   - *Flow*: Auditable Activity Stream
   - *Key Mechanisms*: Non-misleading financial and shift alerts, geofence calibration updates, heat index safety advisories (38°C Wet Bulb), deep-link routing.
2. **{{DATA:SCREEN:SCREEN_6}} — Incident Report & Ground Safety Escalation**
   - *Flow*: Emergency & Incident Reporting
   - *Key Mechanisms*: 5-point classification, 3 severity tiers with instant ground dispatch for physical threats, audio voice note recorder, encrypted witness protection shield.
3. **{{DATA:SCREEN:SCREEN_4}} — Offline Mode & Local Queue Sync Hub**
   - *Flow*: Venue Network Loss Resilience
   - *Key Mechanisms*: Cryptographic local ledger (SHA-256), dynamic offline QR & manual PIN, BLE peer-to-peer mesh handshake with supervisor tablets, cached hardware diagnostics.
4. **{{DATA:SCREEN:SCREEN_2}} — Emergency Marketplace Pause & Safety Lockdown State**
   - *Flow*: Catastrophic Weather / Curfew Protocol
   - *Key Mechanisms*: Broadcast `#EMG-MUM-2025-08` for IMD Red Alert / waterlogging, 100% escrow wage protection guarantee for on-duty workers, safe transit avoidance map, 24/7 disaster desk hotlines.

---

## 2. Truthful State Matrix Compliance Audit

| Lifecycle Phase | Truthful UI Representation | Forbidden / Misleading Anti-Pattern | Audit Status |
| :--- | :--- | :--- | :--- |
| **Worker Application** | `"Application Submitted — Under Screening"` | Displaying `"Hired"` or `"Booking Confirmed"` immediately upon applying | **PASS** |
| **Organizer Selection** | `"Selected — Awaiting Worker Confirmation"` | Automatically adding candidate to locked roster without worker consent | **PASS** |
| **Roster Finalization** | `"Roster 100% Locked — 6/6 Slots Confirmed"` | Claiming confirmed status while pending candidate review | **PASS** |
| **Attendance Check-In** | Dynamic rotating QR token + Geofence match (`±4m`) | Assuming GPS accuracy without hardware coordinate validation | **PASS** |
| **Shift Completion** | `"Shift Ended — Awaiting Supervisor Sign-off"` | Claiming wages are paid upon clocking out | **PASS** |
| **Earnings Settlement** | Itemized 4-stage pipeline (*Disbursed vs Approved Batch vs Under Review vs Projected*) | Labeling unpaid/held escrow balances as `"Money Earned"` or `"Transferred"` | **PASS** |
| **Tax & Verification** | `"Document Submitted — Pending 4-6h Verification"` | Displaying `"Verified GST Registered"` immediately upon user typing GSTIN string | **PASS** |
| **Privacy & Masking** | Masked Aadhaar (`•••• •••• 8291`) and masked phone numbers | Exposing full Aadhaar numbers or private bank accounts to organizers | **PASS** |

---

## 3. Accessibility, Responsive Layout & Usability Verification

1. **Color Contrast & Semantic Indicators**:
   - All critical status states incorporate dual visual cues (Text badge + semantic icon).
   - Slate backgrounds (`#0F172A`, `#1E293B`, `#F8FAFC`) strictly adhere to WCAG 2.1 AA contrast requirements (≥ 4.5:1 for body copy; ≥ 3:1 for large headers).
2. **Touch Targets & On-Site Usability**:
   - Primary mobile action buttons (`Sign-Off Timesheet`, `Check-In Token`, `Emergency Escalation`) feature minimum 48px touch targets with 12px outer spacing margins.
   - Critical destructive actions (e.g., Emergency Marketplace Pause) enforce dual-confirmation safeguards to prevent accidental triggers in high-stress environments.
3. **Typography & Formatting**:
   - Uniform use of **Plus Jakarta Sans** with clean numerical tabular lining for financial amounts in Indian Rupees (`₹`).
   - Time representations strictly use Indian Standard Time (`IST` / `UTC+5:30`) with clear AM/PM indicators.

---

## 4. Engineering Handoff Directives

While these 28 screens provide a high-fidelity visual and interaction specification, backend engineering teams must validate and implement:
1. **Cryptographic Ledger & Geofencing**: Real device-level GPS geofencing with hardware-backed integrity validation, plus Bluetooth Low Energy (BLE) peripheral/central role negotiation for offline venues.
2. **UIDAI Aadhaar Data Vault**: Compliance with Indian regulations mandating encryption at rest and automated redaction of the first 8 digits of Aadhaar numbers.
3. **Escrow Bank Integration**: Direct integration with ICICI / nodal banking webhooks for automated batch disbursal via IMPS/UPI at 23:00 IST.
4. **WebSocket Push Infrastructure**: Sub-second synchronization between organizer check-in scanners and worker mobile apps during morning muster.