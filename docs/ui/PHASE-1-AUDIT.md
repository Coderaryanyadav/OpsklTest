# OPSKL — PHASE 1 UI/UX AUDIT & DESIGN BASELINE

**Date:** 2026-10-20  
**Scope:** Worker Expo app, Organizer Expo app, Admin Next.js portal, `@opskil/design-system`  
**Status:** COMPLETE  
**Method:** Code inventory of all routes/components + review of existing rendered screenshots under `screenshots/`  
**Working tree note:** Uncommitted design-system WIP (13 new components + `ScreenHeader` / `index.ts` edits) is preserved and inventoried below. Do not discard.

---

## 1. Executive verdict

Opskl already has a coherent **monochrome token foundation** and real marketplace screens wired to Supabase — not mockups. Visually it reads as a capable ops product that still feels **assembled from per-screen StyleSheets**, not a single premium system.

| Surface | Maturity | Primary gap |
| :--- | :--- | :--- |
| Design tokens (mobile) | Strong | Missing typography aliases used by WIP components; motion underused |
| Design components (RN) | Expanding WIP | Many new comps unused; apps reimplement patterns inline |
| Worker app | Feature-complete routes | Inconsistent overlays, fake QR affordance, hardcoded colors, a11y gaps |
| Organizer app | Feature-complete routes | Dead draft save, no-op KPI, DS underuse, silent finance errors |
| Admin portal | Functional SPA console | Separate styling island; no DS; no deep links; stub modules |

**Phase 1 does not change product code.** Phases 2–7 implement the redesign against this inventory.

---

## 2. Architecture baseline (preserve)

```
apps/worker          Expo Router 4 · RN 0.76 · Expo 52 · @opskil/design-system
apps/organizer       Expo Router 4 · RN 0.76 · Expo 52 · @opskil/design-system
apps/admin           Next.js 15 App Router · inline CSS vars · @opskil/shared only
packages/design-system   RN tokens + components (Admin does not consume)
packages/shared      Domain + Supabase (business logic — do not weaken)
packages/validation  Zod schemas
packages/config      Empty directory (documented but unimplemented)
```

Business logic, auth gates, RLS, and RPCs stay intact. UI work must not replace failed APIs with hardcoded data.

---

## 3. Complete screen inventory

### 3.1 Worker app — 12 route files

| Route | File | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `/welcome` | `app/welcome.tsx` | Public | First-run entry |
| `/auth/login` | `app/auth/login.tsx` | Public | Sign-in / sign-up (OTP, password, Google) |
| `/onboarding` | `app/onboarding.tsx` | Auth incomplete | KYC + profile completion |
| `/(tabs)` Discover | `app/(tabs)/index.tsx` | Guest + worker | Swipe/list shift discovery |
| `/(tabs)/my-shifts` | `app/(tabs)/my-shifts.tsx` | Auth worker | Bookings & attendance actions |
| `/(tabs)/earnings` | `app/(tabs)/earnings.tsx` | Auth worker | Ledger + UPI |
| `/(tabs)/profile` | `app/(tabs)/profile.tsx` | Auth worker | Trust, settings, account lifecycle |
| `/shift/[id]` | `app/shift/[id].tsx` | Public / worker | Full shift detail + apply |
| `/notifications` | `app/notifications.tsx` | Soft-gated | Inbox + prefs |
| `+not-found` | `app/+not-found.tsx` | — | Unknown route |
| Root overlays | `app/_layout.tsx` | — | Role mismatch / deactivated EmptyStates |

**Local components:** `SwipeCard`, `CardActionControls`, `FilterSheet`, `JobDetailSheet`  
**Tabs:** Discover · My Shifts · Earnings · Profile

**Modals (RN `Modal` only — no ActionSheet / DS BottomSheet usage):**
- Login: forgot password
- Discover: FilterSheet, JobDetailSheet (`pageSheet`)
- Earnings: receipt sheet, UPI edit
- My Shifts: cancel, dispute, QR, SOS, delay, team chat

**Forms:** login (OTP/password/signup), onboarding (6 sections), UPI, cancel/dispute/delay/chat, notification switches

### 3.2 Organizer app — 12 route files

| Route | File | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `/welcome` | `app/welcome.tsx` | Public | First-run entry |
| `/auth/login` | `app/auth/login.tsx` | Public | Org auth |
| `/(tabs)` Shifts | `app/(tabs)/index.tsx` | Guest + org | Dashboard + KPIs + shift list |
| `/(tabs)/create` | `app/(tabs)/create.tsx` | Auth gated | 5-step publish wizard |
| `/(tabs)/roster` | `app/(tabs)/roster.tsx` | Auth gated | Applicant pipeline |
| `/(tabs)/finances` | `app/(tabs)/finances.tsx` | Auth gated | Invoices / reconciliation |
| `/(tabs)/profile` | `app/(tabs)/profile.tsx` | Auth gated | Org profile & settings |
| `/shift/[id]` | `app/shift/[id].tsx` | Soft-gated | Live shift console |
| `/notifications` | `app/notifications.tsx` | Soft-gated | Crew alerts + prefs |
| `+not-found` | `app/+not-found.tsx` | — | Unknown route |
| Root overlays | `app/_layout.tsx` | — | Role mismatch / deactivated |

**Local components:** none (all UI inline in route files)  
**Tabs:** Shifts · Post · Roster · Finances · Profile

**Modals:** forgot password; profile edit `pageSheet`; invoice detail + generate; check-in / no-show / cancel / team chat

### 3.3 Admin portal — 2 routes, 9 client modules

| Surface | File | Notes |
| :--- | :--- | :--- |
| `/login` | `src/app/login/page.tsx` | Email/password |
| `/` SPA shell | `src/app/page.tsx` | Module switch via `useState` — **not URL-routed** |
| Overview | MetricCards + nested queues | |
| verifications | `VerificationQueue` | Modal adjudicate |
| disputes | `DisputesQueue` | Modal adjudicate |
| safety | `SafetyQueue` | Modal resolve |
| jobs | `JobModerationTable` | Modal moderate |
| workers / organizers | `DirectoryTable` | Search + suspend confirm |
| audit | `AuditLogsTable` | Searchable logs |
| settings | `PlatformSettingsPanel` | Killswitch |

**Typed but unimplemented in nav/UI:** `bookings`, `payments`, `reviews`  
**Does not import `@opskil/design-system`.** Styling via `globals.css` vars + inline hex.

---

## 4. Navigation & auth flow map

### Worker
```
welcome ──► auth/login ──► onboarding (if incomplete) ──► (tabs)
guest ──► Discover (+ shift detail / notifications)
gated tabs: my-shifts, earnings, profile → login?redirect=
roleMismatch / isDeactivated → full-screen EmptyState (blocks stack)
```

### Organizer
```
welcome ──► auth/login ──► (tabs)
guest ──► Shifts index only
gated tabs: create, roster, finances, profile → login?redirect=
shift/[id], notifications soft-gated in-screen
```

### Admin
```
middleware: no session → /login; non-admin → unauthorized
/ → client module shell (no history deep links)
```

---

## 5. Empty / loading / error state matrix

| Screen | Loading | Empty | Error |
| :--- | :--- | :--- | :--- |
| Worker Discover | ShiftCardSkeleton | Custom empty + zones | Banner + Retry |
| Worker My Shifts | Skeleton | Guest / no shifts | Retry |
| Worker Earnings | Skeleton | Guest / no ledger | **Silent catch** |
| Worker Profile | Spinner | Guest card | Console only |
| Worker Notifications | Spinner | Empty / guest | **Silent catch** |
| Organizer index | Skeleton | First-shift CTA | Banner + Retry |
| Organizer roster | Skeleton | Guest / filter empty | Retry |
| Organizer finances | Spinner | Guest / no invoices | **Silent catch** |
| Organizer create | — | — | Step-5 inverted error card (dark-mode break) |
| Admin global | Text only | Table colspan text | Banner; weak retry |
| Admin modules | None after first load | Thin empties | `alert()` / inline modalError |

**Offline / permission-denied / stale-data banners:** not first-class across apps.

---

## 6. Design system baseline

### 6.1 Tokens (aligned with Design Vision)

| Token | Light value | Status |
| :--- | :--- | :--- |
| primary / black | `#000000` | OK |
| background / white | `#FFFFFF` | OK |
| textPrimary | `#111111` | OK |
| textSecondary | `#737373` | OK |
| surfaceSecondary | `#F5F5F5` | OK |
| surfaceMuted | `#FAFAFA` | OK |
| border | `#E5E5E5` | OK |
| disabled | `#D4D4D4` | OK |
| semantic success/warn/danger | restrained greens/ambers/reds | OK for a11y only |

Dark palette defined for mobile via `OpsklThemeProvider`. Admin is light-only.

### 6.2 Typography tokens present

`display`, `h1`–`h3`, `subtitle`, `body`, `bodyBold`, `caption`, `micro`, `label`, `wageCallout`

**Broken references in WIP components:**
- `ScreenHeader` → `typography.largeTitle`, `typography.subheadline` (**undefined**)
- `MetricCard` → `typography.title2` (**undefined**)

### 6.3 Component inventory

**Stable / used in apps:** Button, Card, Badge, Input, Typography, EmptyState, LoadingView, ScreenHeader, Skeleton/ShiftCardSkeleton, KeyboardAwareContainer, InlineBanner, Toast, Dialog, BottomSheet, OpsklAlert, Icon, Auth/Theme contexts

**WIP untracked (exported except Stepper):** ApplicantRow, Checkbox, Divider, FilterPills, MetricCard, OtpInput, PasswordInput, Radio, SearchInput, ShiftCard, Toggle, WorkerCard, Stepper (**file exists, not in `index.ts`**)

**Apps still reimplement:** OTP fields, password fields, filter chips, metric grids, applicant rows, shift cards, switches (RN `Switch`), alerts (`Alert` vs `OpsklAlert` vs bare `alert()`)

**Missing vs Design.md checklist:** date/time pickers, wage/location field primitives, segmented control, avatar, document upload/preview, invoice row, bottom-tab as DS, web/Admin primitives, pagination control

---

## 7. Visual review (existing screenshots)

Reviewed files under `screenshots/worker|organizer|admin/` (Oct 15, 2026 captures). Fresh device renders remain required in Phase 7.

### Observed strengths
- Monochrome direction is largely respected on mobile.
- Wage hierarchy on Earnings and Discover is readable.
- Empty/zero states show real zeros — not fabricated earnings.
- Tab bars are clear; primary CTAs (Apply, Post Shift) are visually dominant.

### Observed defects (screenshot-backed)
| Issue | Evidence |
| :--- | :--- |
| Clipped shift titles | Organizer dashboard: “VIP Gala Registration H…” |
| Cramped metric strips | Organizer 4-KPI row; Worker earnings 2×2 grid |
| Card-heavy dashboards | Organizer index + Admin overview KPI grid |
| Generic “template” feel | Worker swipe deck + stacked cards |
| Tan/warning badge for slots | Discover “1 slots left” — semantic OK if paired with text |
| Admin green live-dot + green status copy | Color-primary status communication |
| Admin dense tables + empty colspan | Overview nested queues |
| Duplicate headers | Admin page title + module `h1` |
| Test-data copy visible | “AryanTest”, “Organizer details unavailable” (real empty joins, not fake metrics) |

---

## 8. Cross-cutting UX defects (code)

### Integrity / trust
1. Worker attendance “QR” is a Lucide icon + truncated token — **not a scannable QR**.
2. Profile trust appeal invents `#TR-######` ticket IDs via Alert.
3. Organizer GSTIN “upload” uses fabricated evidence string, not a document picker.
4. Organizer create draft: reads `@opskil_organizer_shift_draft` but **never writes** it.
5. Organizer “Open Positions” KPI `onPress={() => {}}` — dead control.
6. Roster rating fallback `'5.0'` when missing — can overstate trust.

### Consistency
7. Mixed alert APIs: RN `Alert`, `OpsklAlert`, bare `alert()` (earnings/finances).
8. Hardcoded hex/rgba off tokens (Worker Discover failure banner, SwipeCard teal tint, create step-5 inverted card).
9. Emoji in production UI (SOS, disputes, not-found, admin buttons).
10. DS BottomSheet/Dialog/Toast largely unused; RN Modal duplicated.

### Accessibility & responsiveness
11. Many Pressables lack `accessibilityLabel`.
12. Status often color-only (Admin approve/reject fills; green “queue clear”).
13. Admin: no sidebar collapse; tables overflow on narrow widths.
14. Touch targets generally OK where DS Button/header used; chip grids uneven.
15. `numberOfLines={1}` on titles/banners → clipping on compact phones.

### Admin product gaps
16. Modules not deep-linkable; refresh loses place.
17. Stub modules in types/docs without UI.
18. Header killswitch without confirm/reason (settings panel has reason).
19. No pagination; full in-memory loads.
20. Separate visual system from mobile.

---

## 9. Design baseline decisions (for Phase 2+)

These decisions lock direction for subsequent phases:

1. **Single token source of truth:** extend `packages/design-system` tokens; Admin adopts CSS variables mirrored 1:1 (or a thin web adapter) — do not invent a third palette.
2. **Monochrome only** for chrome; semantic colors only for success/warning/error/safety, always with text/icon.
3. **Prefer lists + typography over card grids** for dashboards; metrics as editorial rows or restrained metric cells, not 6 competing KPI cards where avoidable.
4. **Migrate screens onto DS primitives** (OtpInput, PasswordInput, Toggle, FilterPills, ShiftCard, ApplicantRow, MetricCard, Stepper) before inventing new local ones.
5. **Unify overlays:** prefer DS BottomSheet / Dialog / Toast / OpsklAlert; remove bare `alert()`.
6. **Fix typography aliases** (`largeTitle`, `title2`, `subheadline` or rewrite callers to existing keys) before shipping ScreenHeader/MetricCard.
7. **Export Stepper**; document inventory in `docs/ui/DESIGN_SYSTEM.md` (Phase 2/5).
8. **No fake data** for empty states; improve empty/error/offline copy and CTAs instead.
9. **Preserve** guest Discover / guest Shifts browse and all auth/KYC gates.
10. **Working tree WIP** is in-scope for Phase 2 completion, not deletion.

---

## 10. Phase coverage checklist (what must be redesigned)

### Worker (every surface)
- [ ] welcome, login, onboarding
- [ ] Discover (swipe + list), FilterSheet, JobDetailSheet, SwipeCard/actions
- [ ] my-shifts + all 6 modals
- [ ] earnings + receipt/UPI modals
- [ ] profile
- [ ] shift/[id], notifications, not-found
- [ ] role/deactivated overlays

### Organizer
- [ ] welcome, login
- [ ] index dashboard, create wizard (5 steps), roster, finances, profile
- [ ] shift/[id] + 4 modals, notifications, not-found
- [ ] role/deactivated overlays

### Admin
- [ ] login
- [ ] shell (sidebar, header)
- [ ] overview, verifications, disputes, safety, jobs, workers, organizers, audit, settings
- [ ] all 4 adjudication/moderation modals
- [ ] empty/loading/error/responsive states

### Shared
- [ ] Complete DS tokens + components + docs
- [ ] Interaction states catalog
- [ ] A11y + responsive pass (Phase 6)
- [ ] Visual + workflow QA with fresh screenshots (Phase 7)

---

## 11. Incomplete / deferred from Phase 1

| Item | Reason | When |
| :--- | :--- | :--- |
| Live re-render of every screen on device | Phase 1 used code + existing `screenshots/` | Phase 7 (+ spot-checks during Phases 3–5) |
| Fixing typography bugs / exporting Stepper | Implementation | Phase 2 |
| Migrating screens to new components | Implementation | Phases 3–5 |
| Admin deep-link routes | Product+UI change | Phase 5 |
| Implementing stub admin modules (bookings/payments/reviews) | Out of UI-only scope unless required for empty states honesty | Document as unavailable if still missing |

---

## 12. Next phase

**Phase 2 — Universal design system:** fix token bugs, finish WIP components, export Stepper, align Button/Input/overlay states, add missing primitives where justified, mirror tokens for Admin CSS, write `docs/ui/DESIGN_SYSTEM.md`. Do not yet mass-redesign all app screens.

---

*End of Phase 1 audit.*
