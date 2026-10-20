# OPSKL UI/UX — PHASE 3: Worker App Redesign

**Date:** 2026-10-20  
**Scope:** All Worker Expo screens/routes/modals under `apps/worker/`  
**Constraint:** Business logic (Supabase, auth gates, RPCs) preserved. No fake jobs, earnings, wallets, or scannable-QR pretence.

---

## Route inventory (every current route)

| Route / surface | File | Redesigned | Primary DS components |
| :--- | :--- | :---: | :--- |
| Root auth gates + overlays | `app/_layout.tsx` | Yes | `Screen`, `EmptyState`, `OpsklAlert` |
| Welcome | `app/welcome.tsx` | Yes | `Screen`, `Button`, `Badge`, `Divider` |
| Login / signup / OTP / reset | `app/auth/login.tsx` | Yes | `PasswordInput`, `OtpInput`, `SegmentedControl`, `FormField`, `KeyboardAwareContainer` |
| Profile + KYC onboarding | `app/onboarding.tsx` | Yes | `FormField`, `Checkbox`, `DocumentUpload`, `FilterPills`, `SegmentedControl`, `InlineBanner` |
| Tabs shell | `app/(tabs)/_layout.tsx` | Yes | Theme `navigation` tokens |
| Discover | `app/(tabs)/index.tsx` | Yes | `ShiftCardSkeleton`, `ErrorRetry`, `InlineBanner` |
| Swipe card | `src/components/SwipeCard.tsx` | Yes | `WageText`, `Badge`, tokens |
| Card actions | `src/components/CardActionControls.tsx` | Yes | `touchTarget`, tokens |
| Filters | `src/components/FilterSheet.tsx` | Yes | Synced to parent props |
| Job detail sheet | `src/components/JobDetailSheet.tsx` | Yes | Tokens, wage hierarchy |
| My Shifts + attendance | `app/(tabs)/my-shifts.tsx` | Yes | `ErrorRetry`, `StatusIndicator`, `KeyboardAwareContainer` |
| Earnings | `app/(tabs)/earnings.tsx` | Yes | `ErrorRetry`, `FinancialSummary`, `FilterPills`, `OpsklAlert` |
| Profile / settings | `app/(tabs)/profile.tsx` | Yes | `ErrorRetry`, `StatusIndicator`, mailto support |
| Shift detail | `app/shift/[id].tsx` | Yes | `Screen`, `StatusIndicator`, `ErrorRetry`, `InlineBanner` |
| Notifications | `app/notifications.tsx` | Yes | `ScreenHeader`, `ErrorRetry`, `SegmentedControl` |
| Not found | `app/+not-found.tsx` | Yes | `Screen`, `EmptyState` |

**Primary navigation:** Discover · My Shifts · Earnings · Profile (unchanged IA).

---

## Brief coverage (A–F)

### A. Onboarding and authentication

| Requirement | Status |
| :--- | :--- |
| Splash | Platform Expo splash (config); no custom fake splash screen |
| Welcome | Redesigned |
| Role selection | Role mismatch EmptyState when organizer opens worker app |
| Signup / login | Redesigned; OTP + password + Google |
| Email verification / OTP / resend | Supported via auth APIs + UI |
| Password recovery | Forgot-password modal |
| Terms / privacy | Welcome footer + onboarding checkbox; Profile legal links |
| Session expiry / auth failure | AuthProvider + OpsklAlert paths |
| Account recovery | Deactivated EmptyState + restore RPC |
| Loading / retry | LoadingView / button loading / ErrorRetry where loads fail |

### B. Profile and KYC

| Requirement | Status |
| :--- | :--- |
| Profile completion / personal details | Onboarding + Profile |
| Photo upload | **Not in product** — not invented |
| Skills / preferences / localities / emergency / UPI | Onboarding sections |
| Availability | Commute radius + localities (existing model) |
| KYC intro / document type / number | Redesigned; honest DocumentUpload copy |
| Camera/gallery document pick | **Not enabled** — UI discloses this; submits document number for admin review |
| Pending / approved / rejected / resubmit | InlineBanner + Profile checklist |
| Identity protection | Helper copy: masked before storage; appeal does not echo full IDs |

### C. Discovery

| Requirement | Status |
| :--- | :--- |
| Discover home / swipe / list | Redesigned |
| Search | **Not a dedicated search bar** — filters + zones cover discovery (no fake Search bolted on) |
| Filters / sorting | FilterSheet (wage, category, skill, zone); sync fixed |
| Shift cards / full details | SwipeCard + JobDetailSheet + `/shift/[id]` |
| Wage / hours / venue / organizer | Clear hierarchy via WageText + labels |
| Saved shifts | **Not supported** — not invented |
| Empty / loading / network error | Empty CTA, skeleton, ErrorRetry |
| Location permission | Feed uses location utils; apply/check-in gate GPS where required |
| Closed / filled | Excluded by feed rules; detail EmptyState if unavailable |

### D. Applications and My Shifts

| Requirement | Status |
| :--- | :--- |
| Apply / pending / confirmed / declined | Discover apply + My Shifts lifecycle tabs |
| Withdrawal / cancel | Cancel modal (server RPC) |
| Duplicate / KYC / incomplete profile | Failure InlineBanner + onboarding redirects |
| Schedule conflict | Shift detail conflict checks |
| Upcoming / completed / cancelled | Tab filters |
| Empty / error | Empty CTA + ErrorRetry |

### E. Attendance

| Requirement | Status |
| :--- | :--- |
| Check-in eligibility / geofence / GPS accuracy | Existing RPC + alerts |
| Pass code screen | **Attendance Pass Code** (monospace) — not a fake QR |
| Expired code | 60s countdown + regenerate |
| Check-in / check-out success | Only after server `checkInWorkerSafe` / `checkOutWorkerSafe` |
| Dispute / SOS / delay / chat | Modals preserved; chat not claimed encrypted |
| Pre-shift checklist | Reporting instructions on cards / detail |

### F. Earnings and settings

| Requirement | Status |
| :--- | :--- |
| Earnings overview / ledger / UPI / payout | Redesigned; FinancialSummary; **no fake wallet** |
| Load failure | ErrorRetry (not silent zeros) |
| Notifications / prefs | Redesigned + ErrorRetry |
| Support / safety | Profile mailto; My Shifts SOS |
| Logout / account deletion | Profile actions |
| Dark mode / legal | Profile |

---

## Defects fixed

| ID | Fix |
| :--- | :--- |
| **C1** | QR Simulation → Attendance Pass Code |
| **C2** | Fake `#TR-` ticket → `mailto:support@opskil.com` |
| **C5** | Earnings / notifications / profile → `ErrorRetry` |
| **C7** | Removed encryption claim; honest channel copy |
| **M4** | FilterSheet re-syncs when opened |
| **M5** | KeyboardAware on cancel / dispute / delay modals |
| **M6** | Earnings `alert()` → `OpsklAlert` |
| **M11** | Removed “Escrow-Protected Payouts” |
| **Tokens** | Hardcoded hex / teal tint → theme tokens |

---

## Navigation

- Tabs: Discover · My Shifts · Earnings · Profile  
- Stack: welcome, auth/login, onboarding, shift/[id], notifications  
- Auth redirects with `?redirect=` preserved  
- Deep links via notification `actionUrl` + Expo Linking on login  

---

## Test results

```bash
# Cleaned accidental companion .js emit that shadowed TS sources, then:
npm --workspace=@opskil/worker test
# Test Suites: 3 passed | Tests: 22 passed

npm --workspace=@opskil/worker run typecheck
# Clean
```

**Live render:** Worker Discover loading state on Expo web `:8081` (monochrome skeleton + tab bar) after redesign.

Companion `.js` next to sources is now gitignored under `apps/worker/{app,src,__tests__}/**/*.js`.

---

## Remaining gaps (honest)

| Gap | Reason |
| :--- | :--- |
| In-app KYC camera/gallery | No `expo-document-picker` / image picker wired; honest disclosure in UI |
| Scannable QR matrix | No QR encode library; Pass Code UI is intentional |
| Discover text search / saved shifts / worker photo | Not in existing product surface — not fabricated |
| Optimistic Discover apply (M12) | Still removes card before server confirm; failure banner restores |
| Compact vs large phone visual QA | Verified via Expo web + prior mobile screenshots; native device matrix deferred to Phase 7 |

---

*End of PHASE-3.md*
