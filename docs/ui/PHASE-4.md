# OPSKL UI/UX — PHASE 4: Organizer App Redesign

**Date:** 2026-10-20  
**Scope:** All Organizer Expo screens/routes/modals under `apps/organizer/`  
**Constraint:** Business logic (Supabase RPCs, auth gates, verification publish checks) preserved. No fake KPIs, workers, invoices, or payments.

---

## Route inventory (every current route)

| Route / surface | File | Redesigned | Primary DS components |
| :--- | :--- | :---: | :--- |
| Root auth gates + overlays | `app/_layout.tsx` | Yes | `Screen`, `EmptyState`, `OpsklAlert`, `Button` |
| Welcome | `app/welcome.tsx` | Yes | `Screen`, `Button`, `Badge`, `Divider`, `OpsklAlert` |
| Login / signup / OTP / reset | `app/auth/login.tsx` | Yes | `PasswordInput`, `OtpInput`, `SegmentedControl`, `FormField`, `KeyboardAwareContainer` |
| Tabs shell | `app/(tabs)/_layout.tsx` | Yes | Theme `navigation` tokens (Shifts / Post / Roster / Finances / Profile) |
| Dashboard (Shifts tab) | `app/(tabs)/index.tsx` | Yes | `MetricCard`, `ErrorRetry`, `EmptyState`, `InlineBanner`, `StatusIndicator` |
| Create wizard | `app/(tabs)/create.tsx` | Yes | `Stepper`, `DateInput`, `TimeInput`, `WageInput`, `NumericInput`, `Select`, `FilterPills`, `FinancialSummary`, `Toggle`, `InlineBanner` |
| Roster | `app/(tabs)/roster.tsx` | Yes | `FilterPills`, `SearchInput`, `StatusIndicator`, `ErrorRetry`, `EmptyState` |
| Finances | `app/(tabs)/finances.tsx` | Yes | `FinancialSummary`, `SegmentedControl`, `ErrorRetry`, `OpsklAlert`, `StatusIndicator` |
| Profile | `app/(tabs)/profile.tsx` | Yes | `FormField`, `DocumentUpload`, `ErrorRetry`, `Toggle`, `KeyboardAwareContainer` |
| Shift detail | `app/shift/[id].tsx` | Yes | `Screen`, `StatusIndicator`, `ErrorRetry`, `KeyboardAwareContainer`, pass-code UI |
| Notifications | `app/notifications.tsx` | Yes | `ScreenHeader`, `ErrorRetry`, `SegmentedControl`, `Toggle` |
| Not found | `app/+not-found.tsx` | Yes | `Screen`, `EmptyState` (no emoji) |

**Primary navigation (existing IA):** Shifts (dashboard) · Post · Roster · Finances · Profile.

---

## Brief coverage (A–F)

### A. Onboarding and authentication

| Requirement | Status |
| :--- | :--- |
| Welcome | Redesigned |
| Role selection / mismatch | Role mismatch EmptyState + switch-to-organizer RPC |
| Signup / login | Redesigned; OTP + password + Google |
| Email OTP / resend / password recovery | Supported |
| Session / auth failure | AuthProvider + OpsklAlert |
| Account recovery | Deactivated EmptyState + restore RPC |
| Guest explore | Welcome guest CTA → dashboard |

### B. Organization profile and verification

| Requirement | Status |
| :--- | :--- |
| Business details / billing / GSTIN | Profile + edit modal |
| GSTIN evidence | Honest **GSTIN text submission** via `DocumentUpload` (no fake PDF gallery claim) |
| Verification pending / verified / rejected | StatusIndicator + InlineBanner on dashboard |
| Unverified publish | Backend `ORGANIZER_NOT_VERIFIED` surfaced via InlineBanner + OpsklAlert |

### C. Dashboard and shifts

| Requirement | Status |
| :--- | :--- |
| Metrics from `fetchOrganizerMetrics` only | Yes — no invented charts |
| Open Positions | Toggles list filter to shifts with openings (was dead button) |
| Empty / loading / error | EmptyState / skeleton / ErrorRetry |
| Title clipping | `numberOfLines={2}` on org + shift titles |
| Pause / resume / review applicants | Preserved |

### D. Create / Post wizard

| Requirement | Status |
| :--- | :--- |
| 5-step Stepper | Yes |
| Date / time / wage / numeric / select | DS inputs |
| Hourly wage **separate** from total estimated pay | Explicit blocks on steps 4–5 |
| Local draft | `universalStorage.setItem('@opskil_organizer_shift_draft', …)` on Continue/Back; restore on mount |
| Client validation | Aligned with `ShiftCreateSchema` |
| Publish / draft CTAs | Preserved; verification errors clear |

### E. Roster, attendance, communications

| Requirement | Status |
| :--- | :--- |
| Filters / search | FilterPills + SearchInput |
| Rating | Shows **New / unrated** — never `5.0` fallback |
| Status chips | StatusIndicator with text |
| Shift check-in | Pass-code entry (no fake QR scanner); expected token not pre-filled/revealed |
| No-show / cancel / chat modals | KeyboardAwareContainer |

### F. Finances and settings

| Requirement | Status |
| :--- | :--- |
| Hardcoded 98.2% / 0.0% / 42% | **Removed** |
| Fill rate | Computed from real job slots only |
| FinancialSummary + invoices | Real ledger data; OpsklAlert (not `alert()`) |
| Load failure | ErrorRetry (not silent zeros) |
| Profile / dark mode / legal / deletion | Redesigned |

---

## Defects fixed

| ID | Fix |
| :--- | :--- |
| **C4** | Removed hardcoded Attendance / Cost Variance / Loyalty KPIs and “REAL DATA LEDGER” badge |
| **C6** | Open Positions metric toggles open-shift filter (meaningful) |
| **C3** | GSTIN uses honest DocumentUpload “text submission” copy; `text/plain` evidence marker |
| **C5** | Finances / notifications / profile silent catches → ErrorRetry |
| **M1** | Titles allow 2 lines; shift detail uses `largeTitle` ScreenHeader |
| **M2** | MetricCard spacing / typography on dashboard |
| **M3** | Draft `setItem` on step Continue/Back + restore |
| **M13** | Roster rating → New / unrated (no `\|\| '5.0'`) |
| **M6** | Finances / profile / login → OpsklAlert |
| **V1 (create)** | Step-5 error `#111/#FFF` → `InlineBanner` tokens |
| **U10** | Check-in no longer reveals/pre-fills expected pass code |
| **V2** | Not-found emoji removed |

---

## Navigation

- Tabs: Shifts · Post · Roster · Finances · Profile  
- Stack: welcome, auth/login, shift/[id], notifications  
- Auth redirects with `?redirect=` preserved  
- Guest: dashboard browseable; protected tabs → login  

---

## Test results

```bash
npm --workspace=@opskil/organizer test
# Test Suites: 2 passed | Tests: 18 passed

npm --workspace=@opskil/organizer run typecheck
# Clean
```

No accidental companion `.js` files beside `.tsx` sources under `apps/organizer/app/`.

---

## Gaps / not in product (not invented)

| Gap | Note |
| :--- | :--- |
| Camera QR scanner for check-in | Pass-code typing only; UI discloses this |
| Gallery GSTIN PDF picker | Text submission only; DocumentUpload discloses |
| Attendance rate / cost variance / loyalty analytics | Removed fakes; only computed fill rate from jobs |
| Fake charts / demo invoices | Not added |
| Dedicated “Dashboard” tab label | Existing IA uses **Shifts** as dashboard (documented above) |

### Live verification

- Expo web `:8082` — guest dashboard shows real zeros + “Open Positions · Tap to filter list” (no dead control); welcome dark shell renders monochrome CTAs.
- Screenshots: `docs/ui/screenshots/phase4/`

---

*End of PHASE-4.md*
