# OPSKL UI/UX — PHASE 6: Keyboard, Accessibility & Safe Area

**Date:** 2026-10-20  
**Status:** Essentials complete (documented during Phase 7 QA). `PHASE-6.md` was missing at QA start; this records what was already in tree plus fixes applied in the Phase 7 pass.

**Scope:** Cross-app polish after Worker / Organizer / Admin redesigns — keyboard avoidance, touch targets, tab safe areas, screen-reader labels, modal a11y, loading/error honesty.

---

## Checklist

| Item | Status | Notes |
| :--- | :---: | :--- |
| Tab bar safe-area padding (Worker + Organizer) | Fixed | `useSafeAreaInsets` + `tabBarHideOnKeyboard`; height includes bottom inset |
| `BottomTabBar` DS component safe area + roles | Fixed | `accessibilityRole="tablist"/"tab"`, `accessibilityState.selected`, inset padding |
| Tab `tabBarAccessibilityLabel`s | Fixed | Discover / My Shifts / Earnings / Profile; Shifts / Post / Roster / Finances / Profile |
| `KeyboardAwareContainer` on auth + long forms | Fixed | Worker/Organizer login; onboarding; profile edit; chat/forgot modals |
| Touch targets ≥ 44 via `touchTarget` tokens | Fixed (mostly) | Organizer dashboard uses `touchTarget.min`; worker headers retain `hitSlop` |
| Modal `accessibilityViewIsModal` | Fixed | Added across Worker/Organizer modals; single-line JSX reformatted after Expo web SyntaxError |
| Status never color-only | Fixed | `StatusIndicator` / badges with text labels on shift detail, chat, queues |
| Chat load error surfaced | Fixed | `ErrorRetry` wired to `chatLoadError` in worker My Shifts chat modal |
| Admin sidebar Sign out a11y | Fixed | `aria-label` / `title`; 44×44 hit area; CSS vars instead of raw `#A3A3A3` |
| Screen reader coverage on every control | Remaining | Many icon-only buttons have labels; not exhaustively audited with VoiceOver/TalkBack |
| Focus order / trap in all modals | Remaining | Escape/backdrop on Admin modals; RN Modal focus trap not fully verified on web |
| Dynamic type / large text | Remaining | Not systematically tested |
| Reduced motion | Remaining | Motion tokens exist; no `prefers-reduced-motion` wiring |

---

## Issues found

1. **Expo web SyntaxError on Worker login** — single-line `<Modal … onRequestClose={() => …} accessibilityViewIsModal>` confused the bundler (`apps/worker/app/auth/login.tsx`). Blocked Worker web until reformatted multiline. Same pattern normalized on Organizer login, shift detail, finances, Worker earnings / my-shifts.
2. **`chatLoadError` set but unread** — typecheck / honesty gap; fixed with `ErrorRetry`.
3. **Brutal invariant tests brittle after redesign** — expected ALL-CAPS copy and literal `width: 44` (see Phase 7). Updated assertions to match sentence-case `StatusIndicator` labels and `touchTarget.min`.
4. **Admin sidebar decorative hex** — `#262626` / `#A3A3A3` in footer; switched toward CSS variables.

---

## Issues remaining

- Guest can briefly flash protected Organizer tabs (e.g. `/create`) before `_layout` auth effect redirects — race, not intentional guest create.
- Worker My Shifts / Earnings / Profile: layout redirects guests to login; empty “guest” UI in screens is mostly unreachable but still present.
- No automated a11y suite (axe / RN accessibility tests).
- Admin authenticated modules not keyboard-tab audited in this pass (no admin session for visual QA).
- Expo web screenshot tooling letterboxes phone emulation on a wider canvas — visual review used CDP `innerWidth` + snapshots, not only PNG framing.

---

## Verification (Phase 6 essentials)

| Check | Result |
| :--- | :--- |
| Worker Expo web loads after Modal fix | Pass (welcome → guest Discover) |
| Organizer guest dashboard + login gate on roster | Pass |
| Design-system / app typechecks | Pass (see `FINAL_UI_QA.md`) |
