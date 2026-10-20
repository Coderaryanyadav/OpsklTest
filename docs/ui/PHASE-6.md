# OPSKL UI/UX — PHASE 6: Responsiveness, Accessibility & Interaction Repair

**Date:** 2026-10-20  
**Scope:** Worker Expo, Organizer Expo, Next.js Admin, and shared `@opskil/design-system`  
**Constraint:** Preserve business logic and server-confirmed success paths. No fake data. Status must remain readable without color alone. Touch targets ≥ 44px where interactive.

---

## Audit summary

Post-redesign screens were reviewed for layout overflow, keyboard occlusion, double-submit, missing error recovery, VoiceOver/TalkBack labels, focus visibility (Admin), and cross-app consistency with Phase 3–5 monochrome patterns.

| Severity | Theme | Apps |
| :--- | :--- | :--- |
| High | Tab bar overlapped home indicator / keyboard | Worker, Organizer |
| High | Chat / form modals not keyboard-aware | Worker My Shifts, Organizer Shift detail |
| High | Check-in double-submit possible | Worker My Shifts |
| High | Chat load failure silent | Worker My Shifts |
| Medium | Titles clipped at `numberOfLines={1}` | Discover, sheets, ShiftCard, cards |
| Medium | Filter / icon Pressables unlabeled | FilterSheet, Discover, chat report |
| Medium | RN Modal missing dialog semantics | Worker / Organizer modals |
| Medium | Dark `textMuted` contrast | Design-system tokens |
| Medium | Admin keyboard focus / reduced motion | Admin `globals.css` |
| Low | Lifecycle tabs without `accessibilityRole="tab"` | Worker My Shifts |

---

## Issues found → fixes

| Issue | Fix | Location |
| :--- | :--- | :--- |
| Tab bar unsafe area / keyboard | `useSafeAreaInsets` bottom pad + `tabBarHideOnKeyboard` | `apps/worker\|organizer/app/(tabs)/_layout.tsx` |
| Chat modal keyboard occlusion | Wrap in `KeyboardAwareContainer`; `keyboardShouldPersistTaps` | Worker `my-shifts.tsx`, Organizer `shift/[id].tsx` |
| Check-in double tap | `checkInBusyId` lock + Button `loading`/`disabled` | Worker `my-shifts.tsx` |
| Chat fetch errors swallowed | `chatLoadError` + `ErrorRetry` | Worker `my-shifts.tsx` |
| Title clipping | Prefer `numberOfLines={2}` on titles / venues / names | Discover, JobDetailSheet, ShiftCard, SwipeCard, WorkerCard, ApplicantRow, ScreenHeader |
| Unlabeled controls | `accessibilityLabel` / `accessibilityRole` / `selected` state | FilterSheet chips, Discover Profile/Undo, lifecycle tabs, report flag |
| Modal a11y | `accessibilityViewIsModal` + `onRequestClose` | Worker/Organizer modals, FilterSheet, JobDetailSheet |
| Live regions | ErrorRetry assertive; Input a11y label fallback | Design-system `ErrorRetry`, `Input` |
| Dark muted contrast | `textMuted` / secondary → `#A3A3A3` | `packages/design-system/src/tokens/colors.ts` |
| Admin focus ring absent | `:focus-visible` on controls/inputs | `apps/admin/src/app/globals.css` |
| Admin motion | `prefers-reduced-motion: reduce` short-circuits transitions | `apps/admin/src/app/globals.css` |
| Send/Broadcast empty spam | Disable when input blank or sending | Worker chat, Organizer broadcast |

---

## Cross-app consistency

- Shared `ErrorRetry`, `KeyboardAwareContainer`, `ScreenHeader` (2-line titles), status-with-text patterns reused across Worker/Organizer.
- Chat modals both keyboard-aware; send actions gated while busy.
- Filter/tab chips use 44px min height and selected accessibility state.
- Admin keeps CSS-variable monochrome language from Phase 5; focus/motion hardening only (no RN imports).

---

## Remaining limitations

- Native RN `Modal` still lacks full web `role="dialog"` / focus-trap parity; `accessibilityViewIsModal` is the platform equivalent.
- Organizer shift chat does not yet surface a dedicated load-error retry UI (Worker chat does).
- Some dense Admin table cells remain single-line for layout density; truncation is intentional.
- SegmentedControl / Select / DocumentUpload keep single-line labels by design.
- Full automated a11y suite (axe / Detox VoiceOver) not added in this phase; rely on Playwright Admin e2e + unit tests + manual checklist below.

---

## Manual a11y checklist

- [ ] Worker: Discover filter sheet — every chip announces name + selected state
- [ ] Worker: My Shifts tabs — selected tab announced; check-in button shows busy and blocks double tap
- [ ] Worker: Chat — keyboard does not cover Send; failed load shows ErrorRetry
- [ ] Worker/Organizer: Tab bar clears home indicator; hides when keyboard open
- [ ] Organizer: Shift broadcast — keyboard-aware; Broadcast disabled when empty
- [ ] Admin: Tab through sidebar/buttons/inputs — visible focus ring
- [ ] Admin: OS reduced-motion — shell transitions essentially instant
- [ ] Dark mode: secondary/muted text readable on near-black surfaces

---

## Verification

| Suite | Command | Result |
| :--- | :--- | :--- |
| Worker unit | `npm --workspace=@opskil/worker test` | Pass — 22 tests |
| Organizer unit | `npm --workspace=@opskil/organizer test` | Pass — 18 tests |
| Admin e2e | `npm run test:e2e:admin` | Pass — 5/5 Playwright |

---

## Out of scope (Phase 7)

Visual polish pass, screenshot manifesto, store listing assets, and final cross-app regression capture are deferred to Phase 7.
