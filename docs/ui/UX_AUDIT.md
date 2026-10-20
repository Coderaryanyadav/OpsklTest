# OPSKL — UX AUDIT (CODE-VERIFIED)

**Date:** 2026-10-20  
**Rule:** Issues listed only when verified in current source and/or live render. Speculative items excluded.  
**Live renders:** Admin login (`:3000`), Worker Discover loading + welcome (`:8081`), Organizer guest/welcome (`:8082`).  
**Prior screenshots:** `screenshots/` (2026-10-15) used for clipped titles / metrics density where live auth blocked deeper modules.

---

## Severity legend

| Level | Meaning |
| :--- | :--- |
| **Critical usability** | Misleading trust/money/safety, silent failures that look like empty success, dead primary controls |
| **Major usability** | Broken flows, clipped primary content, keyboard/form gaps, inconsistent success feedback |
| **Moderate usability** | a11y gaps, hierarchy inconsistency, guest dead-ends, incomplete features |
| **Visual polish** | Hardcoded colors, emoji, spacing, unused DS, stretched web layouts |

---

## Critical usability

| ID | Issue | Evidence | Surface |
| :--- | :--- | :--- | :--- |
| C1 | Attendance “QR” is not a scannable QR | `my-shifts.tsx` comment “QR Simulation”; Lucide `QrCode` icon + truncated token string | Worker My Shifts |
| C2 | Trust appeal invents ticket IDs | `profile.tsx` `Math.random()` → `#TR-######`; no API | Worker Profile |
| C3 | GSTIN “document upload” is synthetic blob | `organizer/.../profile.tsx` `GSTIN_DOCUMENT_EVIDENCE_…` uploaded as `application/pdf` | Organizer Profile |
| C4 | Finances “REAL DATA LEDGER” shows hardcoded KPIs | `finances.tsx` Attendance `98.2%`, Cost Variance `0.0%`, Loyalty `42%` | Organizer Finances |
| C5 | Earnings / notifications / finances / profile load failures look empty | Silent `catch {}` with no error UI; zeros/empty lists | Worker Earnings/Notifications; Organizer Finances/Profile/Notifications |
| C6 | Open Positions control is a dead button | `index.tsx` `onPress={() => {}}` + `accessibilityRole="button"` “View open positions” | Organizer Dashboard |
| C7 | Chat marked “PRIVATE & ENCRYPTED” without encryption in app | Badge copy in My Shifts chat modal; no crypto implementation | Worker My Shifts |

---

## Major usability

| ID | Issue | Evidence | Surface |
| :--- | :--- | :--- | :--- |
| M1 | Long organizer / shift titles clip | `numberOfLines={1}` on org name + shift title (`index.tsx`); ScreenHeader subtitle (`shift/[id].tsx`); prior screenshot “VIP Gala Registration H…” | Organizer |
| M2 | Cramped dashboard metrics | Metrics cards `width:'48%'`, `padding:10`, label `fontSize:10`; finances cost row same pattern + `numberOfLines={1}` labels | Organizer |
| M3 | Local draft restore never saves | `@opskil_organizer_shift_draft` `getItem`/`removeItem` only — **no `setItem` in repo** | Organizer Create |
| M4 | FilterSheet desyncs from parent | Local `useState` init once; no effect on `currentFilters` | Worker Discover |
| M5 | My Shifts / earnings modals lack KeyboardAware | Grep: no `KeyboardAware` in `my-shifts.tsx`; cancel/dispute/chat inputs can sit under keyboard | Worker |
| M6 | Inconsistent success APIs | `OpsklAlert` vs RN `Alert` vs bare `alert()` (earnings, finances) | Worker + Organizer |
| M7 | Admin modules not deep-linkable | `activeModule` state only; refresh → overview | Admin |
| M8 | Admin login “Return to Overview Shell” → `/` → middleware → `/login` | Looping feel for unauthenticated users (**live login page**) | Admin Login |
| M9 | Wage floor copy vs UI mismatch | Jobs header cites ₹100/hr; badge uses `hourlyRate >= 150` | Admin Jobs |
| M10 | Header killswitch skips reason; settings requires reason | Same pause action, two behaviors | Admin |
| M11 | Discover list still shows “Escrow-Protected Payouts” | `index.tsx` ~515; welcome purged (test 3.8) | Worker Discover |
| M12 | Optimistic apply without clear “pending server” state | Card removed immediately; failure restored via banner (better than silent, still abrupt) | Worker Discover |
| M13 | Roster missing rating shows ★ 5.0 | `\|\| '5.0'` in `roster.tsx`; shift detail uses `'New'` — inconsistent | Organizer Roster |
| M14 | Guest “Create a Shift” → create tab → forced login | Dashboard CTA without clear handoff copy | Organizer |
| M15 | Admin success banner never auto-dismisses | `AdminHeader` toast stays until manual dismiss — can obscure content below | Admin |
| M16 | Dismissed disputes counted as “active” badge | Sidebar badge `status !== 'resolved'` includes `dismissed` | Admin |

---

## Moderate usability

| ID | Issue | Evidence | Surface |
| :--- | :--- | :--- | :--- |
| U1 | Dense shift / applicant cards | Title + badges + fulfillment + dual actions; prior + live skeleton density | Organizer |
| U2 | Inconsistent status chip hierarchy | Roster all `neutral`; dashboard uses variants | Organizer |
| U3 | Inconsistent button hierarchy | Header filled “+ Post Shift” vs outline “Create a Shift” vs Post tab (**live guest dashboard**) | Organizer |
| U4 | Repeated empty patterns | Custom cards vs `EmptyState` vs table colspan vs emoji not-found | All |
| U5 | EmptyState uses flex center + large padding | Can feel sparse on tall phones when sole content | DS + apps |
| U6 | Many Pressables without accessibility labels | Filter chips, mode tabs, notification back “←”, Mark all read | Mobile |
| U7 | Admin: no responsive sidebar / media queries | Fixed 260px; tables overflow; no focus trap on modals | Admin |
| U8 | Stub modules in types without UI | `bookings`, `payments`, `reviews` | Admin |
| U9 | Safety UI: resolve only (no dismiss/escalate) | Shared API supports more statuses | Admin Safety |
| U10 | Check-in modal reveals expected pass code | “Expected System Token: …” | Organizer Shift |
| U11 | KYC evidence on worker onboarding is synthetic string | Same class of issue as GSTIN (worker side) | Worker Onboarding |
| U12 | Guest empty UIs for gated tabs mostly unreachable | Layout redirects before screen guest empty states | Worker tabs |
| U13 | Notifications / profile back controls inconsistent | Custom “←” vs `ScreenHeader` | Both apps |
| U14 | Date/time create fields are free text | High error risk vs pickers | Organizer Create |
| U15 | Admin overview embeds full queues under KPI title | Duplicate H1 hierarchy | Admin |
| U16 | Directory default locality `'Mumbai'` when missing | Can look like real data | Admin Directory |

---

## Visual polish

| ID | Issue | Evidence |
| :--- | :--- | :--- |
| V1 | Hardcoded hex off tokens | Discover failure banner reds; SwipeCard teal tint `rgba(15,118,110,…)`; create step-5 `#111/#FFF`; Google G badge; QR black/white block |
| V2 | Emoji in production UI | Not-found 🔍; SOS/dispute alerts; admin killswitch heading |
| V3 | Expo web stretches mobile chrome full desktop width | Live welcome/dashboard on wide browser |
| V4 | DS components unused while screens reinvent | OtpInput, Toggle, ShiftCard, ApplicantRow, MetricCard, BottomSheet, Toast |
| V5 | Typography token bugs in WIP | `ScreenHeader` → `largeTitle`/`subheadline`; `MetricCard` → `title2` — undefined in `typography.ts` |
| V6 | Stepper file not exported from `index.ts` | WIP incomplete |
| V7 | Admin ignores design-system; parallel CSS vars + inline hex | Two brand implementations |
| V8 | Mumbai location shown twice in Discover header | Live: “MUMBAI” pill + “All Mumbai” filter |
| V9 | Low-contrast dark secondary buttons on welcome | Live dark welcome: Register button vs black bg |

---

## Attention checklist (requested themes)

| Theme | Verdict |
| :--- | :--- |
| Clipped organizer titles / tabs | **Confirmed** titles via `numberOfLines={1}`. Tab labels themselves not clipped in code (fontSize 11, height 68). |
| Cramped dashboard metrics | **Confirmed** (code + prior screenshots + live guest metrics grid). |
| Excessive whitespace in empty states | **Partially confirmed** — EmptyState `flex:1` center + 32px padding; Discover loading shows large white gaps around one skeleton (**live**). |
| Dense shift cards | **Confirmed** packing of title/meta/actions. |
| Inconsistent button hierarchy | **Confirmed** (organizer header vs banner vs tabs; admin colored fills). |
| Inconsistent status chips | **Confirmed** roster-all-neutral vs elsewhere. |
| Repeated empty-state designs | **Confirmed** multiple patterns. |
| Toasts obscure content | **DS Toast unused.** Admin success banner can stick and push/obscure content (**confirmed** no auto-dismiss). Mobile relies on Alerts/modals. |
| Forms fail with keyboard open | **Risk confirmed** on My Shifts modals (no KeyboardAware); login/onboarding/create use KeyboardAwareContainer. |
| Empty content when API fails | **Confirmed** earnings, notifications, finances, profile silent catches. |
| Success before server confirms | Optimistic Discover apply removes card before response (**confirmed**); UPI modal closes 1s **after** awaited save (OK). No premature nav `setTimeout` before server success found. Create post-success Alert + 1.5s redirect after await (OK). |
| Navigation loops / dead ends / back | Admin login overview link loop (**confirmed**). Cross-app portal links are Alerts only. Guest create → login redirect. |
| Fake / hardcoded / misleading data | **Confirmed** C1–C4, C7, U11, M13, finances KPIs, appeal tickets. Production feed explicitly avoids demo fixtures. |

---

## What was checked and **not** confirmed as currently broken

| Claim | Result |
| :--- | :--- |
| Success toast navigation before server | Not found for primary mutations (await then Alert) |
| Demo/fake discovery feed | Explicitly refused in `useDiscoveryFeed` |
| Tab label clipping in tab bar layout | No `numberOfLines` / overflow clip in tab `_layout` files |
| DS Toast obscuring mobile content | Toast not mounted in apps |

---

## Tests covering UI

| Area | Coverage |
| :--- | :--- |
| Worker | Config + phase3 source invariants + swipe logic; Maestro discovery flow |
| Organizer | Config + management RPC/schema; Maestro roster flow |
| Admin | Playwright partial modules; no RTL unit tests |
| Design-system | **Zero** component tests |

---

## Recommended fix order (for later phases — not done here)

1. Critical trust/misleading (C1–C7)  
2. Silent error UI (C5) + dead Open Positions (C6)  
3. Title clipping + metrics density (M1–M2)  
4. Keyboard-safe modals + alert unification (M5–M6)  
5. Design-system completion + screen migration (Phase 2+)  

---

*End of UX_AUDIT.md*
