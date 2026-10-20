# OPSKL — USER FLOWS

**Date:** 2026-10-20  
**Source:** Current Expo Router / Next middleware / AuthProvider gates (code-verified)  
**Apps:** Worker, Organizer, Admin

---

## 1. Role model

| Role | App | Gate |
| :--- | :--- | :--- |
| Guest | Worker / Organizer | Limited browse |
| Worker (incomplete) | Worker | Forced `/onboarding` |
| Worker (ready / verification pending / action required) | Worker | Full tabs |
| Organizer | Organizer | Full tabs after auth |
| Admin | Admin web | `role === 'admin'` + active |
| Wrong-role session | Mobile | Full-screen EmptyState + switch/sign-out |
| Deactivated | Mobile | EmptyState + restore |

---

## 2. Worker flows

### 2.1 First launch → Discover (guest)

```
App open
  └─ no @opskil_worker_welcome_seen
       └─ /welcome
            ├─ Sign In ──────────────► /auth/login
            ├─ Register ─────────────► /auth/login?mode=signup
            └─ Explore as guest ─────► /(tabs) Discover
```

**Exit quirks:** “Opskl Organizer Portal” → informational Alert only (no deep link).

### 2.2 Authentication → ready worker

```
/auth/login
  ├─ OTP / password / Google success
  │    ├─ worker profile incomplete ──► /onboarding ──► Save ──► /(tabs) or ?redirect=
  │    └─ ready ──────────────────────► replace(?redirect || /(tabs))
  └─ wrong role (organizer) ──────────► signOut + Alert
```

**Risk:** Worker profile fetch failure swallowed → may route to onboarding incorrectly.

### 2.3 Discover → apply → My Shifts

```
/(tabs) Discover
  ├─ FilterSheet ── Apply Filters ── refresh feed
  ├─ JobDetailSheet / list Details
  │    └─ /shift/[id]
  │         ├─ guest Apply ── Alert ── /auth/login?redirect=/shift/[id]
  │         └─ worker Apply ── conflict check ── applyForJobSafe
  │              └─ success ── My Shifts / Alert
  └─ Swipe Apply (optimistic remove)
       ├─ success ── card gone
       └─ failure ── banner + restore (AUTH / KYC / retry)
```

### 2.4 My Shifts attendance lifecycle

```
/(tabs)/my-shifts  [auth required]
  ├─ Check-In ── location + checkInWorkerSafe
  ├─ Attendance QR modal ── display token (not encoded QR)
  ├─ Report Delay / Chat / SOS / Cancel / Dispute
  └─ Check-Out ── checkOutWorkerSafe ── Awaiting Sign-Off (disabled CTA)
```

### 2.5 Earnings & UPI

```
/(tabs)/earnings  [auth required]
  ├─ load summary (silent fail → empty zeros)
  ├─ ADD UPI modal ── updateWorkerProfile ── success text ── close 1s later
  └─ Receipt modal ── Initiate payout ── alert() result
```

### 2.6 Profile & trust

```
/(tabs)/profile
  ├─ Checklist ── /onboarding or earnings
  ├─ Appeal ── Alert with fabricated ticket ID (no server)
  ├─ Dark mode toggle
  └─ Sign out / Request deletion
```

### 2.7 Notifications

```
Discover bell ── /notifications
  ├─ guest ── EmptyState ── login
  ├─ Inbox item ── mark read ── optional actionUrl push
  └─ Preferences switches
```

### 2.8 Gated tab redirect (guest)

```
Guest taps My Shifts | Earnings | Profile
  └─ _layout replace ── /auth/login?redirect=/(tabs)/{tab}
```

In-screen guest empty states exist but are normally unreachable.

---

## 3. Organizer flows

### 3.1 First launch → guest dashboard

```
App open
  └─ no @opskil_organizer_welcome_seen
       └─ /welcome
            ├─ Sign In / Register ── /auth/login
            └─ Explore as guest ── /(tabs) Shifts dashboard
```

**Live:** Guest dashboard shows Sign In banner, metric zeros, skeletons, “+ Post Shift”.

### 3.2 Auth

```
/auth/login
  ├─ success ── replace(?redirect || /(tabs))
  ├─ worker account ── switch_user_role_safe (failure swallowed)
  └─ Forgot Password modal
```

### 3.3 Publish shift

```
/(tabs)/create  [auth required]
  Step1 Role → Step2 Schedule → Step3 Duties → Step4 Wages → Step5 Review
    ├─ Publish ── createJobSafe(status open) ── Alert ── replace /(tabs)
    └─ Save Draft ── createJobSafe(status draft) ── Alert
         Local draft key: read/remove only — mid-wizard progress NOT persisted locally
```

### 3.4 Hire from dashboard / roster

```
Dashboard shift card
  ├─ title ── /shift/[id] Live Console
  ├─ Pause / Resume ── updateJobStatus
  └─ Review Applicants ── /(tabs)/roster  (not filtered by that shift)

Roster
  ├─ Shortlist / Decline ── updateApplicationStatusSafe
  ├─ Confirm & Book ── confirmWorkerBookingSafe
  └─ Send Briefing ── Alert only (no send API in UI)
```

**Dead end:** Open Positions metric button does nothing.

### 3.5 Live shift console

```
/shift/[id]
  ├─ guest ── preview + Sign In CTAs
  ├─ Manual Check-In modal (shows expected token)
  ├─ No-Show / Cancel booking modals
  ├─ Standby Confirm Replacement
  ├─ Team Broadcast modal
  └─ GST Invoice ── finances / generateJobInvoiceSafe
```

### 3.6 Finances

```
/(tabs)/finances
  ├─ load (silent fail)
  ├─ Invoice detail modal
  ├─ Generate invoice modal
  └─ Workforce Analytics tab ── some KPIs hardcoded
```

### 3.7 Profile verification

```
/(tabs)/profile
  └─ Edit Profile modal
       └─ GSTIN save ── synthetic PDF evidence ── submitVerificationCaseSafe
```

### 3.8 Gated tabs (guest)

```
Guest taps Post | Roster | Finances | Profile
  └─ _layout ── /auth/login?redirect=/(tabs)/{tab}
```

Dashboard “Create a Shift” / “+ Post Shift” for guests hit the same gate.

---

## 4. Admin flows

### 4.1 Login

```
Any protected URL without session
  └─ middleware ── /login?redirect=
       └─ email/password
            ├─ admin + active ── window.location ── / (or redirect)
            └─ else ── signOut + unauthorized_role
```

**Dead-end feel:** “Return to Overview Shell” → `/` → middleware → `/login` again.

### 4.2 Console module switching (no URL)

```
/
  └─ AdminSidebar setActiveModule
       overview | verifications | disputes | safety | jobs
       | workers | organizers | audit | settings
```

Refresh always returns to `overview`. No browser Back between modules.

### 4.3 Adjudication

```
Verification / Dispute / Safety / Job row
  └─ Modal
       ├─ success ── header green banner (manual dismiss)
       └─ failure ── modalError or alert()
```

### 4.4 Killswitch

```
Header Emergency Pause ── setBookingPauseStatusSafe(default reason)
Settings panel ── custom reason string ── same RPC
```

### 4.5 Directory

```
workers | organizers
  └─ Suspend/Reactivate ── window.confirm ── adminSetUserStatusSafe
```

---

## 5. Cross-app & system flows

### 5.1 Role mismatch

```
Worker app + organizer session ── EmptyState “Organizer Account Detected” ── Sign Out
Organizer app + worker session ── EmptyState + optional switch_user_role_safe
```

### 5.2 Account deletion

```
Profile Request Deletion ── requestAccountDeletionSafe
Later launch isDeactivated ── EmptyState ── Restore (cancelAccountDeletion)
```

### 5.3 Notifications deep link

```
Notification tap ── mark read ── router.push(actionUrl) if present
```

Invalid `actionUrl` → `+not-found` → Return home.

### 5.4 Marketplace happy path (multi-app)

```
Worker registers + KYC
  → Admin VerificationQueue Approve
Organizer registers + GSTIN case
  → Admin Approve
Organizer Create Publish
  → Worker Discover Apply
  → Organizer Roster Confirm
  → Worker My Shifts confirmed
  → Check-in / Check-out
  → Organizer sign-off / Admin dispute if needed
  → Worker Earnings payout
```

(Business logic tested elsewhere; UI must not fake any step.)

---

## 6. Navigation anti-patterns (verified)

| Pattern | Where | Effect |
| :--- | :--- | :--- |
| Auth gate after CTA | Guest Create Shift / Post Shift | Sudden login redirect |
| Alert-only cross-app link | Welcome footers | Dead end for role switch |
| Non-URL modules | Admin | Lost place on refresh; no share links |
| Login → `/` → login | Admin “Return to Overview” | Loop |
| Silent routing catch | Mobile `_layout` | Stay on wrong screen on error |
| Review Applicants unscoped | Dashboard → Roster | Not filtered to that shift |

---

## 7. Flow coverage vs tests

| Flow | Automated coverage |
| :--- | :--- |
| Worker swipe apply/pass | Jest `swipe_marketplace.test.ts` |
| Worker auth/onboarding invariants | `phase3_worker_app.test.ts` |
| Worker discovery (device) | `.maestro/worker_discovery_flow.yaml` |
| Organizer create/book RPCs | `organizer_management.test.ts` |
| Organizer roster (device) | `.maestro/organizer_roster_flow.yaml` |
| Admin overview + some queues | Playwright `admin_dashboard.spec.ts` |
| Full multi-account marketplace | `scripts/test_phase4_marketplace.mjs` (logic, not UI polish) |

---

*End of USER_FLOWS.md*
