# OPSKL — Feature & Route Verification Matrix

**Document Version:** 1.0.0  
**Verification Date:** October 2026  
**Status Key:**
- **VERIFIED:** Code complete, routes tested, database RPC contracts proven by automated tests.
- **PARTIAL:** Implemented in UI and client services, but lacks full automated edge-case coverage or dependent on secondary workflows.
- **EXTERNALLY BLOCKED:** Code and architecture ready, but requires live production third-party credentials (e.g. Bank Escrow, DLT SMS Header, Apple APNs Certificate).
- **BROKEN / DEFECT:** Identified bug or regression.

---

## 1. Worker Mobile App Route Matrix (`apps/worker`)

| Route Path | Feature Description | Status | Verification Evidence / Notes |
| :--- | :--- | :---: | :--- |
| `app/welcome.tsx` | Splash & auth gateway | **VERIFIED** | Auth choice dispatch, deep-link redirect handling. |
| `app/auth/login.tsx` | Mobile OTP & email login | **VERIFIED** | OTP rate limit, schema validation via `@opskil/validation`. |
| `app/onboarding.tsx` | 3-step profile & skill setup | **VERIFIED** | Neutral defaults enforced; verified locality selection. |
| `app/(tabs)/index.tsx` | Marketplace shift feed | **VERIFIED** | Keyset pagination `get_discovery_feed()`; locality filters. |
| `app/(tabs)/my-shifts.tsx` | Active, upcoming & past bookings | **VERIFIED** | 3-hour offer countdown; direct check-in launcher. |
| `app/(tabs)/earnings.tsx` | Payout history & balance ledger | **VERIFIED** | Displays approved payable hours and INR amounts. |
| `app/(tabs)/profile.tsx` | Profile, KYC badge, settings | **VERIFIED** | Displays KYC status badge (`pending`, `verified`, `rejected`). |
| `app/shift/[id].tsx` | Shift details & apply CTA | **VERIFIED** | Shields organizer billing details and supervisor phone. |
| `app/shift/check-in.tsx` | GPS geofence + PIN check-in | **VERIFIED** | Tested with 500m venue radius and 6-digit code. |
| `app/emergency.tsx` | SOS & supervisor emergency call | **VERIFIED** | Standard `tel:` link dispatch to authorized supervisor. |
| `app/notifications.tsx` | In-app notification center | **VERIFIED** | Realtime subscription + local persistent cache. |
| `app/offline.tsx` | Offline mutation queue console | **VERIFIED** | Offline queue reconciliation tested in unit tests. |

---

## 2. Organizer Mobile App Route Matrix (`apps/organizer`)

| Route Path | Feature Description | Status | Verification Evidence / Notes |
| :--- | :--- | :---: | :--- |
| `app/welcome.tsx` | Organizer landing & role gateway | **VERIFIED** | Clean onboarding dispatch. |
| `app/verification.tsx` | Business KYC & GSTIN entry | **VERIFIED** | GSTIN format regex checked via `@opskil/validation`. |
| `app/(tabs)/index.tsx` | Shift management dashboard | **VERIFIED** | Status tabs (`open`, `in_progress`, `completed`). |
| `app/(tabs)/create.tsx` | Multi-step shift creator | **VERIFIED** | Enforces India coords, future start time, wage floor. |
| `app/(tabs)/roster.tsx` | Confirmed workforce roster | **VERIFIED** | Displays slot progress and staff counts. |
| `app/(tabs)/finances.tsx` | FY invoices & billing history | **VERIFIED** | Reads `invoice_fiscal_sequences` numbers. |
| `app/shift/[id]/applicants.tsx` | Candidate review & selection | **VERIFIED** | Shortlist & select RPC triggers; capacity limits. |
| `app/shift/attendance.tsx` | Live supervisor check-in desk | **VERIFIED** | Deep-link fixed; manual supervisor verification. |
| `app/notifications.tsx` | Organizer alerts & updates | **VERIFIED** | Receives application and check-in push events. |

---

## 3. Admin Web Portal Route Matrix (`apps/admin`)

| Route / Component | Feature Description | Status | Verification Evidence / Notes |
| :--- | :--- | :---: | :--- |
| `/login` | Admin credentials gateway | **VERIFIED** | Email/password login with Supabase auth token. |
| `/` (Overview Desk) | Real-time system operations desk | **VERIFIED** | Live metrics, emergency pause modal trigger. |
| `VerificationQueue.tsx` | Worker & Organizer KYC review | **VERIFIED** | Document review, approve/reject RPC calls. |
| `DisputesQueue.tsx` | Shift dispute adjudication | **VERIFIED** | Resolves disputes and updates booking payouts. |
| `JobModerationTable.tsx` | Shift listings inspection | **VERIFIED** | Can pause or cancel violating shift listings. |
| `DirectoryTable.tsx` | User directory & account controls | **VERIFIED** | Admin deactivation tested; revokes privileges immediately. |
| `PlatformSettingsPanel.tsx` | Mumbai minimum wage & settings | **VERIFIED** | Fallback to ₹100 floor verified if setting row missing. |
| `api/auth/register-user` | Backend registration webhook | **VERIFIED** | Gated by `authorizeWorkflow`; `email_confirm: false`. |

---

## 4. Core Backend RPCs & Security Features

| Feature / RPC Name | Target Schema Object | Status | Test & Invariant Evidence |
| :--- | :--- | :---: | :--- |
| `apply_for_job_safe` | `public.applications` | **VERIFIED** | Duplicate applications rejected; open status verified. |
| `confirm_worker_booking_safe` | `public.bookings` | **VERIFIED** | Sets 3h expiry; prevents overbooking slots. |
| `worker_confirm_selection_safe` | `public.bookings` | **VERIFIED** | Enforces 3h expiry; checks overlapping schedule. |
| `check_in_worker_safe` | `public.attendance_records` | **VERIFIED** | Enforces GPS geofence range & code match. |
| `check_out_worker_safe` | `public.bookings` | **VERIFIED** | Rejects checkouts under 15 minutes duration. |
| `complete_shift_and_approve_attendance`| `public.bookings` | **VERIFIED** | Computes billable hours & updates approved pay. |
| `generate_job_invoice_safe` | `public.invoices` | **VERIFIED** | Sequential FY format `OPS/YY-YY/XXXXX`. |
| `initiate_worker_payout_safe` | `public.payments` | **VERIFIED** | Idempotency key enforced; requires completed booking. |
| `resolve_dispute_safe` | `public.disputes` | **VERIFIED** | Restores booking status on dismissal; updates pay. |
| `sweep_expired_worker_offers_safe` | `public.bookings` | **VERIFIED** | Auto-expires unconfirmed offers and rebalances slots. |
| `check_rate_limit_atomic` | `public.rate_limit_buckets` | **VERIFIED** | Multi-instance atomic bucket rate limiting. |
| `set_platform_safety_pause` | `public.platform_settings` | **VERIFIED** | Blocks applications and bookings when paused. |

---

## 5. Externally Blocked & Operational Features

| Feature Name | Dependency Description | Current Fallback / State | Next Steps to Unlock |
| :--- | :--- | :--- | :--- |
| **Direct UPI Settlement** | Live RazorpayX / Cashfree Payouts API | Payout records marked `initiated` with signed payload | Bind production corporate banking API keys |
| **Production SMS Delivery** | Indian DLT Entity & Header registration | Local SMS logging / Supabase Twilio dev channel | Approve DLT template IDs with TRAI |
| **Apple APNs Push Delivery** | Apple Developer Team Push Certificate | Expo Push Notification proxy | Upload `.p8` key to EAS / Supabase Edge Functions |
| **Aadhaar Vault / UIDAI OCR** | Licensed UIDAI AUA/KUA Agency | Manual admin inspection of identity document photo | Procure enterprise KYC provider (e.g., Digio/HyperVerge) |
