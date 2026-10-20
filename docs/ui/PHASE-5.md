# OPSKL UI/UX — PHASE 5: Admin Portal Redesign

**Date:** 2026-10-20  
**Scope:** Next.js Admin portal under `apps/admin/`  
**Constraint:** No React Native design-system imports. CSS variables in `globals.css` only. Server-side RPCs and middleware auth preserved. No fake KPIs, table rows, or documents.

---

## Surface inventory

| Surface | File | Redesigned | Notes |
| :--- | :--- | :---: | :--- |
| Global tokens + admin UI classes | `src/app/globals.css` | Yes | Shell, sidebar, table, btn, status, modal, banner, empty, pagination, input, segment; breakpoints 768 / 640 |
| Root layout | `src/app/layout.tsx` | Yes | Minimal metadata polish |
| Login | `src/app/login/page.tsx` | Yes | Monochrome; removed “Return to Overview” dead loop → “Admin access only” |
| Dashboard shell | `src/app/page.tsx` | Yes | `?module=` deep links; loading / error / retry; killswitch via confirm; disputes badge excludes dismissed |
| Shared UI helpers | `src/components/ui.tsx` | Yes (new) | `StatusPill`, `Pagination`, `EmptyRow`, `TableShell`, `Modal`, `SegmentedControl`, `useClientPagination`, `maskId`, `maskUpi` |
| Sidebar | `src/components/AdminSidebar.tsx` | Yes | Collapse/hamburger; stub modules out of type+nav; LIVE / PAUSED text; `aria-current` |
| Header | `src/components/AdminHeader.tsx` | Yes | Single h1; success banner auto-dismiss ~4s; killswitch confirm + reason |
| Metrics | `src/components/MetricCards.tsx` | Yes | Restrained grid; CSS vars; status pills with text |
| Verifications | `src/components/VerificationQueue.tsx` | Yes | Table polish, pagination, modal a11y, masked IDs |
| Disputes | `src/components/DisputesQueue.tsx` | Yes | Active count excludes dismissed; pagination; status text |
| Safety | `src/components/SafetyQueue.tsx` | Yes | Same table/modal patterns |
| Job moderation | `src/components/JobModerationTable.tsx` | Yes | ₹100/hr floor aligned with schema; pagination |
| Directory | `src/components/DirectoryTable.tsx` | Yes | Search/filter/pagination; no invented locality; masked UPI/GSTIN; confirm suspend; inline errors |
| Audit logs | `src/components/AuditLogsTable.tsx` | Yes | Removed “cryptographically sealed” marketing; pagination; search |
| Settings | `src/components/PlatformSettingsPanel.tsx` | Yes | Killswitch reason required; no emoji; confirm modal |
| Middleware | `src/middleware.ts` | Unchanged | Auth gate remains |

**Primary navigation:** Overview · Verifications · Disputes · Safety · Workers · Organizers · Shifts · Audit logs · Settings.

Stub modules (`bookings` / `payments` / `reviews`) removed from `AdminModule` union and nav.

---

## Defects fixed

| Defect | Fix |
| :--- | :--- |
| Login “Return to Overview” redirected into auth middleware loop | Replaced with static “Admin access only” note |
| Duplicate h1 (breadcrumb + title) | Header shows one title + subtitle |
| Killswitch one-click with no confirm | Header + Settings require confirm; pause requires reason ≥ 5 chars |
| Success banner never auto-dismissed | ~4s auto-dismiss |
| Disputes badge counted dismissed as active | Count only `status !== 'resolved' && !== 'dismissed'` |
| Wage floor badge used ₹150 while schema is ₹100 | Badge + copy use `WAGE_FLOOR_INR = 100` |
| Directory defaulted locality to “Mumbai” | Shows “Locality not set” when null |
| Full UPI / IDs in directory | `maskUpi` / `maskId` (last 4) |
| `alert()` on directory/killswitch errors | Inline banners + thrown errors surfaced in modals |
| Audit “cryptographically sealed” claim | Neutral “database record” copy |
| Settings killswitch emoji | Removed |
| No pagination on large tables | Client pagination via `useClientPagination` |
| Modals lacked dialog semantics / Escape | `role="dialog"`, Escape, backdrop click |
| Sidebar not usable on tablet/phone | Overlay + hamburger; sticky collapse under 768px |
| Stub module types in union | Removed from type and nav |

---

## Responsive notes

- **Desktop (&gt;768):** Sticky 260px sidebar; content max 1400px.
- **Tablet (≤768):** Sidebar off-canvas; hamburger in header; overlay dismiss; 44px min touch targets on primary controls.
- **Phone (≤640):** Single-column metrics; stacked pagination; tighter modal padding.

---

## Security / privacy UX

- Middleware auth unchanged (hiding UI is not security).
- Privileged actions still call shared safe RPCs (`resolveVerificationCaseSafe`, `setBookingPauseStatusSafe`, `adminSetUserStatusSafe`, etc.).
- Masked profile / case / booking IDs (last 4); UPI partially masked; GSTIN last 4.
- Document evidence still via short-lived signed URL only when path exists.
- No invented financial detail beyond fetched metrics/ops data.

---

## Visual review (rendered)

Login reviewed at three widths after redesign (dev server `:3000`):

| Viewport | Capture |
| :--- | :--- |
| Desktop 1440×900 | `docs/ui/screenshots/phase5/admin_login_desktop.png` |
| Tablet 768×1024 | `docs/ui/screenshots/phase5/admin_login_tablet.png` |
| Narrow 390×844 | `docs/ui/screenshots/phase5/admin_login_narrow.png` |

Observations: monochrome card centered; “Admin access only” (no overview redirect loop); form usable at narrow width; primary Sign in CTA clear. Authenticated module tables require an admin session (not captured in this pass without credentials).

---

## Test results

| Check | Result |
| :--- | :--- |
| `npm --workspace=@opskil/admin run typecheck` | **Passed** (`tsc --noEmit`) |
| Playwright Chromium install | Completed for local e2e |
| `npm --workspace=@opskil/admin run test:e2e` | **5/5 passed** (overview, verifications, disputes, job moderation, audit) |

---

## Gaps / follow-ups

- Server-side pagination not implemented (client slice only); fine for current queue sizes.
- Directory refresh still full-dashboard reload.
- E2E coverage is smoke-level; modal Escape / killswitch confirm not fully asserted.
- No dark-mode admin theme (light monochrome only, matching portal use).
- Organizer GSTIN shown masked but not validated format in UI (backend remains source of truth).
- Authenticated desktop/tablet/narrow screenshots of queues require live admin credentials.
