# Opskl Design System

Universal UI foundation for **Worker** (Expo), **Organizer** (Expo), and **Admin** (Next.js).  
Package: `@opskil/design-system` → `packages/design-system`.

**Phase 2:** Extend and consolidate the existing token + component library.  
Do not invent a second parallel system. Screen migrations happen in Phases 3–5.

---

## Principles

- Monochrome brand chrome (`#000000` / `#FFFFFF` / greys). Semantic color only for success, warning, danger, safety.
- Hierarchy via typography, spacing, alignment, and separators — **not** nested cards by default.
- Every interactive control defines default, pressed/focused, selected (when applicable), disabled, loading, and validation/error states.
- No decorative controls without real behavior (e.g. `DocumentUpload` requires host `onPick`).
- Touch targets ≈ **44–48 pt** minimum (`touchTarget` tokens).
- Status never by color alone — always include a text label (`StatusIndicator`, `Badge`).

---

## Tokens

### Color (`src/tokens/colors.ts`)

| Token | Light | Use |
|---|---|---|
| `primary` | `#000000` | Primary actions |
| `primaryHover` | `#262626` | Pressed primary |
| `background` / `surface` | `#FFFFFF` | Screen / card surface |
| `surfaceMuted` | `#FAFAFA` | Subtle surface |
| `surfaceSecondary` | `#F5F5F5` | Secondary background |
| `textPrimary` | `#111111` | Primary text |
| `textSecondary` | `#737373` | Secondary text |
| `border` | `#E5E5E5` | Dividers |
| `disabled` | `#D4D4D4` | Disabled controls |
| `success` / `warning` / `danger` | restrained greens / ambers / reds | Status only |
| `dangerHover` | `#991B1B` | Pressed destructive |

Full light + dark palettes are defined. Mobile uses `OpsklThemeProvider` (`light` \| `dark` \| `system`).

### Typography (`src/tokens/typography.ts`)

| Group | Keys |
|---|---|
| Primary | `display`, `h1`–`h3`, `subtitle`, `body`, `bodyBold`, `caption`, `micro`, `label` |
| Domain | `wageCallout` |
| Buttons | `button`, `buttonSm`, `buttonLg` |
| Aliases | `largeTitle`, `title1`–`title3`, `headline`, `subheadline`, `footnote` |

### Font weights (`src/tokens/layout.ts` → `fontWeights`)

`regular` 400 · `medium` 500 · `semibold` 600 · `bold` 700 · `heavy` 800

### Spacing & radii (`src/tokens/spacing.ts`)

**Spacing:** `none` 0 → `massive` 48  
**Radii:** `xs` 4 → `xl` 20, `full`  
**Shadows:** `none`, `sm`, `md`, `lg`

### Layout (`src/tokens/layout.ts`)

| Token group | Contents |
|---|---|
| `iconSizes` | `xs` 14 → `xxl` 32 |
| `touchTarget` | `min` 44 · `comfortable` 48 · `large` 56 |
| `componentSizes` | input/button heights, chip, avatar, OTP cell, status dot |
| `navigation` | tab bar 68, header 44, sidebar 260, content max 1400 |
| `safeArea` | fallback insets when SafeArea unavailable |
| `breakpoints` | phone · phoneLarge 430 · tablet 768 · desktop 1024 · desktopWide 1280 |

### Motion (`src/tokens/motion.ts`)

`duration` (instant→pulse), `easing` (standard/decelerate/accelerate), `spring` (press/sheet/success).

---

## Theme API

```tsx
import { OpsklThemeProvider, useOpsklTheme } from '@opskil/design-system';

const {
  colors, spacing, radii, shadows, typography, motion,
  fontWeights, iconSizes, touchTarget, componentSizes,
  navigation, safeArea, breakpoints, isDark, setMode,
} = useOpsklTheme();
```

Safe defaults are returned outside a provider (tests / Storybook).

---

## Component inventory

All exported from `@opskil/design-system`.

### Layout & navigation

| Component | Role | States |
|---|---|---|
| **Screen** | Safe-area container; optional scroll + pull-to-refresh | — |
| **ScreenHeader** | Title / large title / back / right action | Pressed back |
| **KeyboardAwareContainer** | Keyboard-safe scroll forms | — |
| **BottomTabBar** | Reusable bottom nav | Default / selected / pressed |
| **SegmentedControl** | Tabs / segments | Default / selected / pressed / disabled |
| **Stepper** | Multi-step progress | Current / complete / upcoming |
| **Divider** | Separator (± label) | — |
| **FilterPills** | Horizontal filters | Default / selected / pressed |
| **Pagination** | Prev / next page | Default / pressed / disabled |

### Actions & inputs

| Component | Role | States |
|---|---|---|
| **Button** | `primary` \| `secondary` \| `outline` \| `danger` \| `ghost` · `sm`/`md`/`lg` | Default / pressed / disabled / loading |
| **Input** | Text field | Focus / error / disabled |
| **PasswordInput** | Password + show/hide | Focus / error / disabled |
| **OtpInput** | Digit OTP | Focus / error / disabled |
| **SearchInput** | Search + clear | Focus / disabled |
| **WageInput** | ₹ numeric wage | Focus / error / disabled |
| **NumericInput** | Integer / decimal | Focus / error / disabled |
| **DateInput** | `YYYY-MM-DD` text date | Focus / error / disabled |
| **TimeInput** | `HH:MM` text time | Focus / error / disabled |
| **Select** | Modal single-select | Default / pressed / selected / disabled / error |
| **Checkbox** | Boolean | Checked / pressed / disabled |
| **RadioGroup** | Exclusive choice | Selected / pressed / disabled |
| **Toggle** | Switch | On / off / disabled |
| **FormField** | Label + control + helper/error | Error / helper |
| **DocumentUpload** | Pick / preview / clear | Default / loading / error / has-file (requires real `onPick`) |

### Domain display

| Component | Role |
|---|---|
| **ShiftCard** | Shift summary row/card |
| **WorkerCard** | Worker profile summary |
| **ApplicantRow** | Roster applicant + actions |
| **MetricCard** | Single metric (use sparingly) |
| **FinancialSummary** | Editorial wage/fee/total lines (no fake totals) |
| **StatusIndicator** | Status chip with mandatory label (+ optional dot) |
| **Badge** | Compact status / category chip |
| **DataTable** | Dense operational table |
| **Card** | Interactive surface only when needed |
| **Typography** / **WageText** | Text helpers |

### Feedback & system states

| Component | Role |
|---|---|
| **EmptyState** | Empty with optional CTA |
| **OfflineBanner** / **OfflineState** | Offline strip / full state + retry |
| **ErrorRetry** | API failure banner or block + retry (not empty zeros) |
| **InlineBanner** | In-flow alert |
| **Toast** | Transient top toast |
| **Dialog** | Confirmation modal |
| **BottomSheet** | Sheet overlay |
| **LoadingView** | Spinner |
| **Skeleton** / **ShiftCardSkeleton** | Loading placeholders |
| **OpsklAlert** | Cross-platform alert helper |
| **ErrorBoundary** | Render error boundary |

Also: `AuthContext`, `useRequireAuth`, `usePushNotifications` — **do not weaken auth**.

---

## Interaction state matrix

| State | Pattern |
|---|---|
| Default | Token colors, 1px border where needed |
| Pressed / focused | `primaryHover`, `borderFocus`, scale ≈ 0.98, wash with `primaryLight` |
| Selected | Filled surface / bold label / checkmark (Select, segments, pills) |
| Disabled | Muted surface + opacity; non-interactive |
| Loading | `Button.loading`, `DocumentUpload.loading`, skeletons |
| Validation error | Danger border + caption error text (`Input`, `FormField`, `Select`, `DocumentUpload`) |
| Offline | `OfflineBanner` / `OfflineState` |
| Server error | `ErrorRetry` — never replace with hardcoded success data |

---

## Consumption

### Worker & Organizer

```tsx
import {
  OpsklThemeProvider, Screen, ScreenHeader, Button,
  WageInput, ErrorRetry, StatusIndicator, useOpsklTheme,
} from '@opskil/design-system';
```

Wrap root once with `OpsklThemeProvider`. Prefer tokens over hardcoded hex.

### Admin

Admin does not import RN components yet. Use CSS variables in `apps/admin/src/app/globals.css` (mirrored from `lightColors` + spacing/radii). Migrate surfaces in Phase 5.

---

## Quality checklist (Phase 2)

- [x] Central monochrome + semantic tokens  
- [x] Typography, weights, spacing, radii, shadows  
- [x] Component dimensions, navigation, icon sizes, motion, safe area fallbacks, breakpoints  
- [x] Light/dark via ThemeProvider (Admin light CSS mirror)  
- [x] Core + domain + feedback components with interaction states  
- [x] No decorative upload without host behavior  
- [x] Prefer lists/typography over card grids (`FinancialSummary`, `DataTable`)  
- [ ] Full screen migration (Phases 3–5)  
- [ ] Admin web component adapter (Phase 5)  
- [ ] Storybook / visual regression suite  

---

## Verify

```bash
npm --workspace=@opskil/design-system run typecheck
npm test
# Representative renders (dev servers):
# Worker :8081 · Organizer :8082 · Admin :3000
```
