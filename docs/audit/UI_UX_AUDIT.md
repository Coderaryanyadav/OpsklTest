# UI / UX Audit — Opskl

> Audit type: static code review of UI surfaces (no emulator/screenshot pass).
> Commit: `699a409` plus uncommitted organizer guest-browsing edits, which were reviewed only for context and left untouched.
> Labels: **VERIFIED** / **INFERRED** / **UNKNOWN**.
> Severity reflects user harm and trust impact, not visual polish.

---

## 1. Summary

The UI is visually ambitious and generally consistent in spacing/typography, but it repeatedly presents **fabricated operational data as live**, **claims capabilities that do not exist**, and **hides failure**. The most serious UX problems are trust problems:

1. At `HEAD`, organizer roster renders five hardcoded shifts regardless of the organizer's actual jobs (P1). **Current worktree note:** uncommitted organizer work replaces these cards with `filteredShifts.map(...)`; residual issues are stale filter chips (“BKC Complex”, “NESCO Goregaon”, “May 2025”) and a missing committed/tested baseline. This audit does not treat the uncommitted work as final.
2. Worker earnings says “✓ DISBURSED VIA UPI” and offers a PDF download that does nothing (P1).
3. Screening marks candidates shortlisted/declined even when the server call fails (P1).
4. Attendance offers a “supervisor PIN” flow that is actually just the worker's check-in code and bypasses server-side proof (P1).
5. Worker check-in silently substitutes a different booking when the requested one is missing (P1).
6. Incident reporting simulates an audio memo and displays unsupported response SLAs (P1).
7. Several screens dead-end or trap users (onboarding UPI, cancellation modal, emergency page).

**Overall UX grade: D+** — polished presentation undermined by nonfunctional core flows and misleading status copy.

---

## 2. Global patterns

### 2.1 Positive patterns (VERIFIED)
- Shared design system (`packages/design-system`) with consistent color/spacing tokens.
- Loading, empty, and error states exist on most list screens (e.g. roster, my-shifts, notifications).
- Pull-to-refresh on core lists.
- Confirmations for destructive actions in several places.
- Accessibility labels on many icon buttons (not all).

### 2.2 Systemic problems

| ID | Pattern | Examples | Severity |
|---|---|---|---|
| G1 | Hardcoded operational data presented as live | finances wage pool, contender count, SLA badges | P1 |
| G2 | Success toast shown regardless of server result | `if (res.success \|\| true)` in screening | P1 |
| G3 | Simulated capabilities | audio memo timer, PDF download no-op, “automated UPI disbursement” | P1 |
| G4 | Inconsistent source of truth between screens | finances says automated payout; payment sheet says no live rail | P2 |
| G5 | Error details swallowed or genericized | screening, attendance, incident | P2 |
| G6 | Destructive flows without clear escape | onboarding UPI gate, cancellation modal reachability | P2 |
| G7 | Stale/dated content | emergency “24 May 2025”; roster “May 2025” chips | P2 |
| G8 | Missing empty-state honesty | dashboards show metrics even with zero real jobs | P2 |

---

## 3. Worker app

### 3.1 `welcome` / `auth/login`
**VERIFIED**
- Phone/email auth entry with OTP flow; redirect support.
- Login redirects to onboarding if `profileCompletionStatus !== 'completed'` or no skills (`apps/worker/app/auth/login.tsx:145-146`).
- Error messaging is present but OTP rate-limit/provider failures surface as generic errors.

**UX issues**
- **P2:** No “resend code” cooldown explanation; users can hammer resend and hit provider limits.
- **P2:** Redirect query param is trusted for in-app navigation; not validated against an allowlist (low risk in RN, but still).

### 3.2 `onboarding` — UPI completion trap
**VERIFIED**
- Step 2 requires UPI validation (`isValidIndianUpiId`) and only sets `profileCompletionStatus: 'completed'` **inside** `if (upiId.trim())` (`apps/worker/app/onboarding.tsx:321-328`).
- There is no explicit “skip UPI” path that still completes the profile, yet copy elsewhere implies payout setup can be done later.
- `_layout.tsx:71-72` forces any authenticated profile with incomplete status back to `/onboarding`.

**Impact (P1):** a worker who cannot or will not provide UPI at signup is trapped in onboarding and cannot browse or apply. This blocks the supply side of the marketplace. It also conflates KYC completion with payout setup.

**P2:** Progress indicator does not explain that UPI is mandatory before completion.

### 3.3 `(tabs)/index` — discovery
**VERIFIED**
- Job cards with venue, wage, date, slots, and apply CTA.
- Empty state exists when no jobs.
- Filters for locality/role.

**Issues**
- **P2:** Wage display sometimes shows hourly vs total inconsistently across card and detail; users must infer.
- **P2:** “Urgent”/“Filling fast” badges are derived from job status but not from time-to-shift, so they can be stale.
- **P2:** Apply failure due to KYC returns a generic alert rather than a direct route to verification.

### 3.4 `(tabs)/my-shifts`
**VERIFIED**
- Tabs for upcoming/active/completed/cancelled.
- Cancellation flow calls `cancelBookingSafe` and updates local state (`:332-352`).
- Hardcoded social proof: “selected your profile from 38 contenders” (`:783`) — not computed from data.
- Countdown/progress elements are time-derived client-side and can drift; no server reconciliation.
- **P2/P1:** The cancellation modal exists (`:1322`) but the visible “Cancel” entry point is conditional and can be unreachable for some statuses; users report no way to cancel (INFERRED from conditional rendering around `:1228`).

**Impact:** workers cannot reliably tell whether they are confirmed, waitlisted, or cancelled; the “38 contenders” line erodes trust when the same number appears for every shift.

### 3.5 `(tabs)/earnings`
**VERIFIED**
- Summary cards for total earned/pending.
- Per-shift rows with status chips including “✓ DISBURSED VIA UPI” (`:607`).
- “Download Monthly Pay Statement (PDF)” button has `onPress: () => {}` (`:731-754`).
- Copy elsewhere admits ledger-only settlement.

**Impact (P1):** Workers are told money has been disbursed when only a database row exists. The no-op PDF button compounds the impression of a formal payroll system. This is a financial-trust and potentially consumer-protection issue.

**P2:** Amount formatting is inconsistent (₹ symbol vs “INR” in some rows); pending vs processing semantics unexplained.

### 3.6 `shift/[id]`
**VERIFIED**
- Detail view with venue map, pay breakdown, requirements, check-in CTA.
- Apply/withdraw actions.

**Issues**
- **P2:** Map preview may show a static coordinate even when job coordinates are NULL; no “location not provided” state.
- **P2:** Requirement chips can overflow on small screens (INFERRED from fixed row layouts).

### 3.7 `shift/checkin` — wrong-booking fallback
**VERIFIED** — `apps/worker/app/shift/checkin.tsx:26-42`:
```
const targetId = bookingId || id;
...
setBooking(bookings[0]);
```
If the requested booking is not found in the fetched list, the screen silently displays the **first** booking. A worker tapping “Check in” for shift A can see shift B's details and submit a check-in for the wrong booking (subject to server authorization). This is a P1 correctness/safety issue.

**P2:** Geofence/permission errors are shown as generic alerts; no guidance to enable location.
**P2:** No checkout action on this screen, even after check-in (`check_out_worker_safe` exists but is not wired).

### 3.8 `incident/report`
**VERIFIED**
- Category/severity selection, photos, location text, witness toggle.
- “Record Memo” runs a timer and toggles `hasVoiceNote` (`:116-147`) but **captures no audio**; payload sends `hasAudioMemo: hasVoiceNote` (`:193`).
- Static SLA badges: “30m RESPONSE”, “INSTANT GROUND DISPATCH” (`:80-88`).
- Photo upload failure is handled correctly (blocks submission).

**Impact (P1):** Users may believe a voice record exists as evidence when it does not. SLAs are not backed by any dispatch system. In a safety context this is unacceptable.

**P2:** After submission, case reference is partly client-generated (`INC-${Date.now()...}`) if server omits one, so references can be non-authoritative.

### 3.9 `emergency`
**VERIFIED**
- Full-screen emergency/lockdown guidance.
- Displays “24 May 2025, 14:00 IST” (`:216`) — a stale, dated event presented as current.
- Screen is not linked from tabs, header, or incident flow (INFERRED from navigation inventory).

**Impact (P2):** Dead, misleading safety surface. Either wire it to live alerts or remove it.

### 3.10 `offline`
**VERIFIED**
- Offline queue UI and backup PIN display.
- Backup PIN is static `'884 - 219'` (`packages/shared/src/services/offline_queue_service.ts:196-198`), not per-user or rotated.

**Impact (P2):** A static “security” PIN provides no security and may mislead users into trusting offline check-in.

### 3.11 `notifications`
**VERIFIED**
- List with read/unread, deep links.
- **P2:** No grouping; high-volume notifications become noisy.
- **P2:** Push permission denial is not surfaced with remediation steps.

### 3.12 `profile`
**VERIFIED**
- KYC status, documents, skills, UPI, sign out.
- **P2:** Verification rejection reasons are terse; no resubmission guidance beyond a button.
- **P2:** UPI edit does not re-trigger verification or warn that payouts may fail.

---

## 4. Organizer app

### 4.1 `(tabs)/index` — dashboard
**VERIFIED**
- KPI cards, recent shifts, quick actions.
- KPI values mix live queries with synthetic defaults (INFERRED from shared pilot metrics usage).
- Uncommitted guest-browsing edits change empty-state behavior; not assessed as final.

**Issues**
- **P2:** With zero real jobs, dashboard can still show nonzero-looking pilot metrics; no “demo data” badge.
- **P2:** “Live” indicators are static dots, not realtime subscription status.

### 4.2 `(tabs)/create` — post job
**VERIFIED**
- Multi-field job form with role requirements, pay, slots, venue.
- Validation exists for required text/numbers.
- **P1 (INFERRED):** Venue coordinates are optional/not collected in a way that guarantees `jobs.latitude/longitude`. Since geofence is skipped when coordinates are NULL, organizers can unknowingly create jobs with no on-site verification.
- **P2:** Pay preview does not clearly show worker net vs organizer total + fees.
- **P2:** Draft restore exists but no conflict handling for multiple drafts.

### 4.3 `(tabs)/roster` — fabricated at HEAD, live in uncommitted work (P1 at HEAD)
**VERIFIED at `HEAD` (`699a409`)** — `apps/organizer/app/(tabs)/roster.tsx:375-991`:
- Renders five static shift cards (“Delegate Registration & Badge Desk Associate”, “Taj Lands End, Bandra West • 18 May 2025”, `#OPS-8841`, “24 APPLIED”, “Escrow locked: ₹14,400”, etc.).
- Live `shifts`/`applications` state is fetched (`:62-73`) and used for counts, but the card list itself was hardcoded.

**Current worktree (uncommitted, user work)** — the diff replaces the hardcoded block with `filteredShifts.map((shift) => ...)` using real `shift.title`, `venueName`, `applications.length`, `slotsFilled`, and date. The main fabrication is therefore **fixed in the working tree but not committed, typechecked, or tested**. Residual issues:
- Filter chips still hardcode `['BKC Complex', 'NESCO Goregaon', 'May 2025']` (`:343`).
- The draft card shows a locally stored title; it is honest about being unpublished.
- `getTodayDateIST` and `Users` imports are currently unused (typecheck errors), indicating unfinished work.

**Impact (P1 at HEAD / P3 residual):** At the audited commit, an organizer with one or zero jobs saw five fake shifts with fake applicant counts and fake escrow — the most damaging trust defect in the organizer app. The uncommitted fix is the right direction; it needs tests, a committed baseline, and cleanup of the stale chips.

### 4.4 `shift/screening` — false success
**VERIFIED**
- Candidate list with shortlist/decline/select actions.
- `handleShortlist` and `handleDecline` both use `if (res.success || true)` (`:231`, `:249`), so the UI always shows success and mutates local state even when the RPC fails.
- Countdown copy claims “Spot is held with a 3-hour countdown” (`:264`) but no countdown timer is rendered/enforced client-side.

**Impact (P1):** Organizers believe candidates were shortlisted or declined when nothing changed server-side. They may show up to a shift with an unconfirmed crew.

**P2:** No bulk actions; screening large applicant pools is slow.
**P2:** Candidate cards do not show reliability/no-show history even though data exists.

### 4.5 `shift/crew`
**VERIFIED**
- Confirmed crew list, contact actions, check-in codes.
- **P2:** Check-in codes are displayed in plaintext; shoulder-surfing risk.
- **P2:** No standby/waitlist section despite standby logic existing in the schema.

### 4.6 `shift/attendance` — fake supervisor proof
**VERIFIED**
- Roster with check-in status and a “Manual PIN Entry” modal (`:143-146`, `:985-1051`).
- On submit, `const code = supervisorPin.trim() || target.checkInCode || ''` (`:248`): if the supervisor leaves the PIN blank, the worker's own check-in code is used. The “supervisor token authorization” copy (`:1021`) is therefore false — there is no separate supervisor credential.
- A banner admits QR/turnstile scanning is not integrated (`:643`).
- Screen mixes live attendance with static operational numbers (INFERRED).

**Impact (P1):** Anyone with organizer access can mark any worker present without a supervisor secret or geofence. Combined with the server-side supervisor bypass, attendance is effectively self-attestable.

**P2:** No bulk check-in, no late-arrival flags, no undo with audit reason.

### 4.7 `shift/[id]`
**VERIFIED**
- Job detail, applicant summary, edit/cancel actions.
- **P2:** Cancellation impact (worker notifications, refunds) is not previewed.
- **P2:** Editing a live job with confirmed workers has no guardrail.

### 4.8 `(tabs)/finances`
**VERIFIED**
- Invoice list, escrow status, payment reference submission.
- Hardcoded wage pool “₹14,400” (`:551`).
- Claims “Automated disbursement to crew UPI accounts releases following final sign-off” (`:581`) while the payment sheet correctly says “Live nodal bank account / UPI VPA details are not provisioned in this build... does not move bank funds automatically” (`:930`).
- Invoice count fallback of `2` appears in summary logic (INFERRED from code path; see logic audit).
- PDF/export actions are limited or absent.

**Impact (P1/P2):** Contradictory financial copy. Organizers may believe payouts are automatic when they are manual database updates. The hardcoded wage pool makes totals wrong for any real job.

**P2:** No reconciliation view linking invoice → payment record → UTR → worker.
**P2:** No tax/GST breakdown drill-down despite collected fees.

### 4.9 `verification`
**VERIFIED**
- Document upload, status, resubmission.
- **P2:** No clear SLA for review; status polling only.
- **P2:** Rejection reasons are free text and can be empty.

### 4.10 `notifications` / `profile` / `welcome`
- Same patterns as worker: adequate structure, generic errors, limited empty-state honesty.
- **P2:** Organizer profile lacks team/member management UI even though `organizer_memberships` exists in the schema.

---

## 5. Admin console

**VERIFIED** — Next.js single-page console + `/login`.

### 5.1 `/login`
- Email/password sign-in.
- `redirect` query param is used directly: `window.location.href = redirectUrl` (`apps/admin/src/app/login/page.tsx:70-72`). **P2 open-redirect** (can send admins to an attacker-controlled origin after login).
- No MFA, no session timeout messaging.

### 5.2 `/` console
- Tabs/sections for users, organizers, jobs, payments, disputes, platform settings (INFERRED from single-page structure).
- Dispute resolution calls the broken RPC (see logic audit) → **P1**: the action fails, likely with a raw PostgREST error.
- Payout “mark settled” accepts an arbitrary UTR with no format validation or reconciliation. **P1** financial-control gap.
- Tables lack pagination/virtualization for large datasets (INFERRED).
- Destructive actions (suspend user, delete job) rely on browser `confirm`, not typed confirmation. **P2**.
- No audit-log viewer, despite `audit_logs` being written by RPCs. **P2**.
- Error surfaces often expose raw Supabase messages. **P2** information disclosure.

### 5.3 Admin API routes
- `/api/auth/register-user` mints pre-confirmed accounts using the service-role key with **no admin session check** (P1 — see logic audit). `/api/auth/register-organizer` is fail-closed behind `ALLOW_DIRECT_ORGANIZER_REGISTRATION=true` and rejects existing accounts. From a UX standpoint, these are unlinked utility endpoints with no visible admin-only framing.

---

## 6. Fake / misleading data inventory

| Location | What is shown | Reality | Severity |
|---|---|---|---|
| `apps/organizer/app/(tabs)/roster.tsx:375-991` (HEAD only) | 5 shifts, applicant counts, escrow ₹14,400, dates in May 2025 | Hardcoded JSX; replaced by live `filteredShifts` in uncommitted work; stale filter chips remain | P1 at HEAD / P3 residual |
| `apps/organizer/app/(tabs)/finances.tsx:551` | “₹14,400 crew wage pool” | Hardcoded | P1 |
| `apps/worker/app/(tabs)/earnings.tsx:607` | “✓ DISBURSED VIA UPI” | `payment_records` status only | P1 |
| `apps/worker/app/(tabs)/earnings.tsx:731-754` | Download PDF | No-op handler | P1 |
| `apps/worker/app/(tabs)/my-shifts.tsx:783` | “selected from 38 contenders” | Hardcoded | P1 |
| `apps/organizer/app/shift/screening.tsx:231,249` | “Worker Shortlisted” / “Application Declined” | Shown even on failure (`\|\| true`) | P1 |
| `apps/organizer/app/shift/screening.tsx:264` | “3-hour countdown” | No timer/enforcement | P2 |
| `apps/organizer/app/shift/attendance.tsx:248,1021` | “Supervisor token authorization” | Falls back to worker code | P1 |
| `apps/worker/app/incident/report.tsx:80-88` | “30m RESPONSE”, “INSTANT GROUND DISPATCH” | Static copy | P1 |
| `apps/worker/app/incident/report.tsx:116-147,193` | Audio memo recorded | Timer only; no audio captured | P1 |
| `apps/worker/app/emergency.tsx:216` | “24 May 2025” lockdown | Stale/static | P2 |
| `packages/shared/src/services/pilot_metrics_service.ts:33-487` | 18 “pilot” records, metrics | Synthetic fixtures | P2 (P1 if presented as live) |
| `packages/shared/src/services/system_killswitch_service.ts:12` | 99.94% success, 42 ms | Defaults, not measurements | P2 |
| `packages/shared/src/services/offline_queue_service.ts:196-198` | Backup PIN “884 - 219” | Static | P2 |
| `apps/organizer/app/(tabs)/finances.tsx:581` | “Automated disbursement” | Manual DB update only | P1 |

---

## 7. Navigation and flow gaps

| Gap | Evidence | Severity |
|---|---|---|
| Emergency screen unreachable | no route/link in tabs or incident flow | P2 |
| No worker checkout UI | `check_out_worker_safe` exists; no screen action | P1 |
| Cancellation modal can be unreachable | conditional render in `my-shifts.tsx` | P2 |
| Onboarding cannot complete without UPI | `onboarding.tsx:321-328` | P1 |
| Check-in substitutes wrong booking | `checkin.tsx:26-42` | P1 |
| No dispute status/detail screen for workers | only creation paths in UI | P2 |
| No organizer team management | `organizer_memberships` unused in UI | P2 |
| No admin audit-log view | `audit_logs` write-only | P2 |
| No invoice PDF/export | finance actions incomplete | P2 |

---

## 8. Accessibility and platform notes

**VERIFIED / INFERRED**
- Many icon-only buttons have `accessibilityLabel`, but several do not (e.g. some tab icons, filter chips).
- Font scaling is mostly respected via React Native `Text`, but fixed-height cards may clip at large accessibility sizes.
- Color contrast: primary green on white and white on green appear acceptable; muted gray secondary text may fall below WCAG AA at small sizes (INFERRED, not measured).
- Touch targets: most primary buttons ≥ 44 pt; small chips and icon buttons sometimes below.
- No screen-reader pass was run. **UNKNOWN** actual VoiceOver/TalkBack behavior.
- No RTL/i18n support; all copy is English with Indian currency formatting.
- Offline mode is partial: lists may render cached data but actions fail with generic alerts.

---

## 9. UX prioritization

**Fix first (P0/P1):**
1. Commit/finish the live roster change and remove remaining fabricated finance/earnings data; delete stale filter chips.
2. Make screening and attendance reflect real server results; never `|| true`.
3. Wire or remove the PDF button and “disbursed” claims.
4. Fix check-in booking fallback and onboarding UPI gate.
5. Replace simulated audio/SLA copy with honest states.

**Then (P2):**
6. Add checkout action and cancellation entry point.
7. Add loading/error specificity (geofence, permissions, KYC).
8. Remove/date-stamp emergency content.
9. Add admin audit log and typed confirmations.
10. Fix open redirect and raw error leakage.

---

## 10. What could not be assessed

- Real rendering, animation, keyboard behavior, and safe-area handling on iOS/Android.
- Actual accessibility tree and screen-reader output.
- Performance with large datasets (no load test).
- Visual design fidelity to brand guidelines (no design spec in repo).
- Behavior of the uncommitted organizer guest-browsing work in its final form.
