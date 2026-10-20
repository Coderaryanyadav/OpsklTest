# OPSKL — COMPLETE SCREEN INVENTORY

**Date:** 2026-10-20 (updated Phase 7)  
**Method:** Source inspection after Phases 2–6 redesign + Phase 7 live renders (Admin `:3000`, Worker Expo web `:8081`, Organizer Expo web `:8082`)  
**Behavior:** Redesign preserved auth gates and safe RPCs; no invented populated data in QA  
**Live captures:** `docs/ui/screenshots/phase7/` (also phase1–5)  
**Final QA:** `docs/ui/FINAL_UI_QA.md` · a11y pass: `docs/ui/PHASE-6.md`  
**Prior catalog:** `screenshots/{worker,organizer,admin}/` (2026-10-15)

---

## Summary counts (post-redesign)

| App | Routes | Tab items | Modals / sheets | Root overlays | Design system |
| :--- | ---: | ---: | ---: | ---: | :--- |
| Worker | 10 (+ tabs layout + root) | 4 | 11 | 2 (role / deactivated) | `@opskil/design-system` |
| Organizer | 10 (+ tabs layout + root) | 5 | 8 | 2 (role / deactivated) | `@opskil/design-system` |
| Admin | 2 URL routes | 9 client modules (nav) | Shared `ui.tsx` modals | — | CSS vars in `globals.css` (no RN DS imports) |

---

## A. Worker app (`apps/worker`)

### Navigation shell

| Item | Path | File |
| :--- | :--- | :--- |
| Root Stack + auth gates | — | `apps/worker/app/_layout.tsx` |
| Tabs | `/(tabs)` | `apps/worker/app/(tabs)/_layout.tsx` |
| Tabs | Discover · My Shifts · Earnings · Profile | icons from `@opskil/design-system` |

**Auth rules (verified):** Guests redirected from `my-shifts`, `earnings`, `profile`, `onboarding` → `/auth/login?redirect=…`. Welcome flag `@opskil_worker_welcome_seen`. Profile incomplete → `/onboarding`.

---

### W1 — Welcome

| Field | Detail |
| :--- | :--- |
| **Route / file** | `/welcome` · `apps/worker/app/welcome.tsx` |
| **Role** | Guest / first-run |
| **Purpose** | Brand intro; drive Sign In, Register, or guest Discover |
| **Entry** | Root when welcome not seen |
| **Exit** | → `/auth/login`, `/auth/login?mode=signup`, `replace('/(tabs)')`; Organizer link → Alert only |
| **Main action** | Sign In / Register |
| **Secondary** | Explore as guest; Organizer Portal Alert; ToS footer (text only) |
| **Data** | Sets `@opskil_worker_welcome_seen` |
| **Components** | `Button`, `Badge`, lucide icons |
| **Loading / empty / error / success** | Static; storage catch swallowed |
| **Tests** | `phase3_worker_app.test.ts` (marketing claim purge) |

---

### W2 — Login

| Field | Detail |
| :--- | :--- |
| **Route / file** | `/auth/login` · `apps/worker/app/auth/login.tsx` |
| **Role** | Guest |
| **Purpose** | OTP / password / Google sign-in & signup; password reset |
| **Entry** | Welcome; gated redirects; Discover/apply prompts |
| **Exit** | Back; → `/onboarding` or `redirect` / `/(tabs)` |
| **Main action** | Verify OTP / Sign In / Create Account |
| **Secondary** | Google; Forgot Password modal; Resend verification; mode tabs |
| **Data** | `useAuth` methods; `fetchUserProfile` / `fetchWorkerProfile` |
| **Components** | `ScreenHeader`, `Input`, `Button`, `Card`, `KeyboardAwareContainer`, RN `Modal` |
| **States** | Button loading; Alerts for success/error; OTP UI |
| **Tests** | Layout `expectedRole` in phase3 |

#### Modal W2a — Forgot Password
Email → `sendPasswordReset` → success Alert; Cancel closes.

---

### W3 — Onboarding

| Field | Detail |
| :--- | :--- |
| **Route / file** | `/onboarding` · `apps/worker/app/onboarding.tsx` |
| **Role** | Auth-incomplete (also Profile re-entry) |
| **Purpose** | Identity, localities, skills, emergency, UPI, KYC, terms |
| **Entry** | Root incomplete; login; Profile checklist |
| **Exit** | Back / Save → `replace(redirect \|\| '/(tabs)')`; no user → EmptyState → login |
| **Main action** | Save Profile & Continue |
| **Secondary** | Chip multi-selects; Aadhaar/PAN toggle |
| **Data** | Profile + verification APIs; synthetic KYC evidence string (not file picker) |
| **Components** | `ScreenHeader`, `Input`, `Button`, `Card`, `Badge`, `EmptyState`, `KeyboardAwareContainer` |
| **States** | Spinner; EmptyState; field errors; rejected/pending banners; success Alert |
| **Tests** | phase3 KYC + terms present |

---

### W4 — Discover (tabs index)

| Field | Detail |
| :--- | :--- |
| **Route / file** | `/(tabs)/index` · `apps/worker/app/(tabs)/index.tsx` |
| **Role** | Guest + worker |
| **Purpose** | Swipe/list shift discovery |
| **Entry** | Tabs; guest welcome; post-auth |
| **Exit** | Notifications; Profile (KYC); login; `/shift/[id]`; sheets |
| **Main action** | Apply |
| **Secondary** | Pass, undo, filters, list/swipe toggle, refresh, zone pills |
| **Data** | `useDiscoveryFeed` → feed/apply/pass APIs; unread count (catch → 0) |
| **Components** | DS Badge/Button/Card/WageText/ShiftCardSkeleton; local `SwipeCard`, `CardActionControls`, `JobDetailSheet`, `FilterSheet` |
| **Loading** | `ShiftCardSkeleton` + “Scanning verified shifts…” (**live captured**) |
| **Empty** | Filter-aware empty card + zone CTAs |
| **Error** | Connection Error banner + Retry |
| **Success** | Optimistic remove; failure banner restore |
| **Tests** | `swipe_marketplace.test.ts`; phase3 zones/feed |

#### Sheet W4a — JobDetailSheet (`src/components/JobDetailSheet.tsx`)
`pageSheet` Modal; Pass / Apply; title `numberOfLines={1}`.

#### Sheet W4b — FilterSheet (`src/components/FilterSheet.tsx`)
Locality/category/wage/skill; Apply / Reset. Local state not resynced from parent props.

---

### W5 — My Shifts

| Field | Detail |
| :--- | :--- |
| **Route / file** | `/(tabs)/my-shifts` · `apps/worker/app/(tabs)/my-shifts.tsx` |
| **Role** | Worker (layout redirects guests to login) |
| **Purpose** | Bookings lifecycle + attendance tools |
| **Entry** | Tab; post-apply |
| **Exit** | Discover; Maps; tel:; modals |
| **Main action** | Context: Check-In / Check-Out / etc. |
| **Secondary** | QR, Delay, Chat, Cancel, Dispute, SOS, Copy pass, Navigate |
| **Data** | Bookings + attendance + safety + chat RPCs; `expo-location` |
| **Components** | Card/Badge/Button/WageText/Input/ShiftCardSkeleton/`OpsklAlert`/`ErrorRetry`/`StatusIndicator`/`KeyboardAwareContainer` |
| **States** | Skeletons; error+Retry; empty tab; chat `ErrorRetry`; guest redirected by root layout |
| **Tests** | phase3 GPS + past-shift categorization |
| **Phase 7** | Authenticated booking UI **not** visually checked (no session) |

#### Modals W5a–W5f
| Modal | Purpose |
| :--- | :--- |
| Cancel | Reason ≥5 → `cancelBookingSafe` |
| Dispute | Reason ≥10 → `disputeBookingSafe` |
| Attendance QR | 60s countdown; **Lucide icon + truncated token** (“QR Simulation”) |
| SOS | `createSafetyReportSafe` + dial 112 |
| Delay | +15/30/45/60 → `reportWorkerDelaySafe` |
| Chat | Messages + report flag |

---

### W6 — Earnings

| Field | Detail |
| :--- | :--- |
| **Route / file** | `/(tabs)/earnings` · `apps/worker/app/(tabs)/earnings.tsx` |
| **Role** | Worker |
| **Purpose** | Settled wages, ledger, UPI, initiate payout |
| **Entry** | Tab; Profile UPI |
| **Exit** | Discover; receipt/UPI modals |
| **Main action** | Initiate payout / manage UPI |
| **Secondary** | Ledger filters |
| **Data** | `fetchWorkerEarningsSummary`, `updateWorkerProfile`, `initiateWorkerPayoutSafe` |
| **States** | Skeletons; empty ledger; **load `catch` → no error UI** (zeros look empty) |
| **Success feedback** | Global `alert()` for payout (not OpsklAlert) |
| **Tests** | phase3 no “100% WAGE GUARANTEE” |

#### Modal W6a — Receipt · W6b — Default UPI

---

### W7 — Profile

| Field | Detail |
| :--- | :--- |
| **Route / file** | `/(tabs)/profile` · `apps/worker/app/(tabs)/profile.tsx` |
| **Role** | Worker |
| **Purpose** | Identity, trust, checklist, theme, legal, account lifecycle |
| **Entry** | Tab; Discover KYC banner |
| **Exit** | Onboarding; Earnings; external URLs; sign-out |
| **Main action** | Complete checklist / manage account |
| **Secondary** | Dark mode; appeal; delete |
| **Data** | Profile, verification case, trust score, deletion RPC |
| **Misleading** | Appeal invents `#TR-` + `Math.random()` — **no API** |
| **Tests** | phase3 verification badges |

---

### W8 — Shift detail

| Field | Detail |
| :--- | :--- |
| **Route / file** | `/shift/[id]` · `apps/worker/app/shift/[id].tsx` |
| **Role** | Guest view / worker apply |
| **Purpose** | Full shift + conflict-aware apply |
| **Entry** | Discover Details; notifications `actionUrl`; login redirect |
| **Exit** | Back; login; My Shifts after apply |
| **Main action** | Apply |
| **Data** | `fetchJobById`, conflicts, `applyForJobSafe` |
| **States** | Spinner; EmptyState unavailable; conflict banners |
| **Tests** | None dedicated |

---

### W9 — Notifications

| Field | Detail |
| :--- | :--- |
| **Route / file** | `/notifications` · `apps/worker/app/notifications.tsx` |
| **Role** | Guest EmptyState / worker |
| **Purpose** | Inbox + prefs + push priming |
| **Entry** | Discover bell |
| **Exit** | Back; login; `actionUrl` |
| **Data** | Notifications + prefs + realtime + push hook |
| **Error** | Silent `catch {}` |
| **Tests** | None |

---

### W10 — Not found

`apps/worker/app/+not-found.tsx` → “Return to Shifts” `replace('/')`.

### Root overlays
Role mismatch / deactivated EmptyStates in `_layout.tsx`.

---

## B. Organizer app (`apps/organizer`)

### Navigation shell

| Tabs | Shifts · Post · Roster · Finances · Profile |
| Guests | Only `index` free; other tabs → login |

---

### O1 — Welcome · `apps/organizer/app/welcome.tsx`
Guest first-run; Sign In / Register / guest → `/(tabs)`; Worker App Alert only.  
**Live:** dark welcome captured on `:8082`.

### O2 — Login · `apps/organizer/app/auth/login.tsx`
OTP/password/Google/register + Forgot Password modal; `KeyboardAwareContainer`.

### O3 — Shifts dashboard · `apps/organizer/app/(tabs)/index.tsx`

| Field | Detail |
| :--- | :--- |
| **Role** | Guest + organizer |
| **Purpose** | KPIs, live shifts, pause/resume |
| **Main** | Open `/shift/[id]` |
| **Secondary** | Post Shift, Review Applicants → roster, Pause, notifications |
| **Data** | `fetchOrganizerProfile/Jobs/Metrics`, `updateJobStatus` |
| **Loading** | ShiftCardSkeleton ×2 (**live guest view**) |
| **Empty** | First-shift CTA |
| **Error** | Banner + Retry |
| **Verified layout** | Org name & shift title `numberOfLines={1}`; metrics `width:'48%'` padding 10 |
| **Dead control** | Open Positions `onPress={() => {}}` while `accessibilityRole="button"` |

### O4 — Create · `apps/organizer/app/(tabs)/create.tsx`
5-step wizard; Publish / Save Draft (server `status:'draft'`). Local key `@opskil_organizer_shift_draft` is **get/remove only — never setItem**. `KeyboardAwareContainer`.

### O5 — Roster · `apps/organizer/app/(tabs)/roster.tsx`
Filter chips; Shortlist / Decline / Confirm; Briefing Alert only. Rating fallback `'5.0'`. Status badges all `variant="neutral"`.

### O6 — Finances · `apps/organizer/app/(tabs)/finances.tsx`
Spend/invoices/recon/analytics. Silent load catch. Hardcoded analytics `98.2%`, `0.0%`, `42%` beside “REAL DATA LEDGER”. Modals: invoice detail, generate. Uses `alert()`.

### O7 — Profile · `apps/organizer/app/(tabs)/profile.tsx`
Edit modal; GSTIN upload = synthetic string blob as PDF. Dark mode; deletion.

### O8 — Shift console · `apps/organizer/app/shift/[id].tsx`
Attendance console. Modals: check-in (shows expected token), no-show, cancel, broadcast. `ScreenHeader` subtitle clips title (`numberOfLines={1}`).

### O9 — Notifications · `apps/organizer/app/notifications.tsx`
Silent load catch; prefs switches.

### O10 — Not found · `apps/organizer/app/+not-found.tsx`

### Tests
`app.test.ts` (config); `organizer_management.test.ts` (schema/RPC mocks — not UI).

---

## C. Admin portal (`apps/admin`)

### URL routes

| Route | File | Role |
| :--- | :--- | :--- |
| `/login` | `src/app/login/page.tsx` | Public → admin |
| `/` | `src/app/page.tsx` | `profiles.role === 'admin'` |
| API | `src/app/api/auth/register-organizer/route.ts` | No UI |

**Live:** login rendered at `http://localhost:3000/login` → `docs/ui/screenshots/phase1/admin_login_live_2026-10-20.png`.

Modules are **client state** (`activeModule`), not URLs. Typed stubs unused: `bookings`, `payments`, `reviews`.

| Module | Component | Main action | Modals |
| :--- | :--- | :--- | :--- |
| `overview` | MetricCards + nested queues | Browse KPIs | via embeds |
| `verifications` | VerificationQueue | Approve/Reject | Adjudicate |
| `disputes` | DisputesQueue | Investigate | Adjudicate |
| `safety` | SafetyQueue | Mark Resolved | Investigate |
| `jobs` | JobModerationTable | Approve/Pause/Cancel | Reason |
| `workers` / `organizers` | DirectoryTable | Suspend/Reactivate | `window.confirm` |
| `audit` | AuditLogsTable | Search | — |
| `settings` | PlatformSettingsPanel | Killswitch | — |

**Chrome:** `AdminSidebar` (260px fixed), `AdminHeader` (success banner toast — no auto-dismiss).  
**Loading:** Full-page “Loading operations console…”.  
**Does not use** `@opskil/design-system`.

**Tests:** `e2e/admin_dashboard.spec.ts` (partial modules); shared admin/trust Jest.

---

## D. Shared UI package inventory (consumed vs WIP)

**Used heavily:** Theme, Auth, Button, Card, Badge, Input, EmptyState, ScreenHeader, Skeleton, KeyboardAwareContainer, WageText, OpsklAlert (partial), icons.

**WIP untracked / unused in apps:** ApplicantRow, Checkbox, Divider, FilterPills, MetricCard, OtpInput, PasswordInput, Radio, SearchInput, ShiftCard, Toggle, WorkerCard; Stepper not exported.

**DS Toast:** Exists; **not imported by any app screen**. Admin uses custom header banner instead.

---

## E. Screenshot evidence index

### Live (2026-10-20)
| File | Surface |
| :--- | :--- |
| `docs/ui/screenshots/phase1/admin_login_live_2026-10-20.png` | Admin login |
| `docs/ui/screenshots/phase1/worker_discover_skeleton_live.png` | Worker Discover loading |
| `docs/ui/screenshots/phase1/worker_welcome_dark_live.png` | Worker welcome (dark) |
| `docs/ui/screenshots/phase1/organizer_guest_dashboard_live.png` | Organizer welcome/guest path |

### Prior catalog (2026-10-15)
See `screenshots/README.md` — Worker ×8, Organizer ×6, Admin ×11.

---

*End of SCREEN_INVENTORY.md*
