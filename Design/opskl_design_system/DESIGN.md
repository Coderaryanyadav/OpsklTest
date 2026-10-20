---
name: Opskl Design System
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#434653'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#737784'
  outline-variant: '#c3c6d5'
  surface-tint: '#1d59c1'
  primary: '#003c90'
  on-primary: '#ffffff'
  primary-container: '#0f52ba'
  on-primary-container: '#bcceff'
  inverse-primary: '#b0c6ff'
  secondary: '#5d5e63'
  on-secondary: '#ffffff'
  secondary-container: '#e2e2e8'
  on-secondary-container: '#636469'
  tertiary: '#324257'
  on-tertiary: '#ffffff'
  tertiary-container: '#49596f'
  on-tertiary-container: '#bfd0ea'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#b0c6ff'
  on-primary-fixed: '#001945'
  on-primary-fixed-variant: '#00419c'
  secondary-fixed: '#e2e2e8'
  secondary-fixed-dim: '#c6c6cc'
  on-secondary-fixed: '#1a1c20'
  on-secondary-fixed-variant: '#45474b'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.025em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.005em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-xs:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
  numeric-data:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes a high-trust, operational standard for short-duration and on-demand event staffing. The interface balances high-velocity execution with executive poise—serving enterprise event organizers, production managers, and gig-based hospitality professionals across Mumbai.

### Visual Tone & Aesthetic Discipline
- **Style Archetype:** Contemporary Institutional Modernism. Characterized by stark contrast, restrained hairline framing, razor-sharp typographic alignment, and absolute absence of extraneous visual noise.
- **Atmosphere:** Calm, deliberate, decisive, and authoritative. It strips away ornamental tech tropes—no neon washes, no simulated 3D assets, no frosted glassmorphism, and no decorative gradients.
- **Human & Operational Clarity:** Every screen must be instantly readable under erratic field conditions—such as outdoor sunlight at Mumbai racecourses or backstage low-light production areas. State transitions, pay slips in Indian Rupee (`₹`), and Indian Standard Time (`IST`) reporting take precedent over decorative layouts.

### Cross-Role Cohesion
The system serves three operational contexts with a single unified visual grammar:
1. **Worker Mobile:** Fast, high-legibility touch targets, offline-resilient card layouts, prominent check-in/out timestamps, and clear verification milestones.
2. **Organizer Mobile:** Real-time roster checklists, rapid batch-action buttons, instant attendance confirmation, and clear escalation paths.
3. **Admin Web Console:** Information-dense, multi-column operational grids, auditable event timelines, KYC verification consoles, and ledger disbursement controls.

## Colors

The color system operates on extreme restraint. Chrome surfaces remain neutral and grounded, reserving high-saturation chroma exclusively for focus points, verified states, and deliberate interactive affordances.

### Palette Architecture
- **Primary Accent (`#0F52BA` — International Precision Blue):** Reserved for primary calls-to-action, active selection controls, link interaction states, and verified trust markers. It signifies system legitimacy and contractual commitment.
- **Foundation Dark / Secondary (`#0F1115` — Obsidian Charcoal):** The anchor for high-contrast primary text, deep structural framing, primary dark buttons, and top-tier navigational surfaces.
- **Neutral Surface Scale:**
  - `Canvas Canvas / Base`: `#F8F9FA`
  - `Card / Surface Default`: `#FFFFFF`
  - `Surface Muted / Layered`: `#F1F3F5`
  - `Border / Hairline`: `#E2E4E8`
  - `Border Strong / Focus Ring`: `#CBD5E1`
- **Text & Hierarchy Neutral (`#64748B` — Slate Secondary):** Used for microcopy, field captions, timestamp labels, and tabular metadata. Accessible on both white and light gray surfaces.

### Operational State Tokens
Status must never rely solely on color. Every status pairs an explicit background/text token with an icon and uppercase text label:
- **Draft / Inactive:** Background `#F1F5F9`, Text `#475569`, Border `#CBD5E1`
- **Applied / Under Review:** Background `#EFF6FF`, Text `#1D4ED8`, Border `#BFDBFE`
- **Selected / Confirmed:** Background `#EEF2FF`, Text `#3730A3`, Border `#C7D2FE`
- **Checked-In / Active Shift:** Background `#ECFDF5`, Text `#047857`, Border `#A7F3D0`
- **Disputed / Flagged:** Background `#FEF2F2`, Text `#B91C1C`, Border `#FECACA`
- **Paid / Completed:** Background `#F0FDF4`, Text `#15803D`, Border `#BBF7D0`

## Typography

Typographic discipline provides the structural backbone of this design system. It combines the architectural balance of Plus Jakarta Sans for structural headers with the neutral, utilitarian clarity of Inter for dense operational interfaces.

### Typographic Rules & Tabular Figures
- **Tabular Figures Feature (`font-feature-settings: "tnum" on, "cv05" on`):** All compensation values, time fields, roster counts, and verification codes must enforce monospaced tabular numbers to maintain strict vertical scanning alignment in financial logs and roster tables.
- **Currency Presentation:** The Indian Rupee symbol (`₹`) is rendered alongside tabular numbers without a space (e.g., `₹2,400.00`), using `font-weight: 500` or `600` to prevent visual collision with adjacent text.
- **Time Presentation:** Operational times are strictly rendered in 12-hour or 24-hour formats with explicit zone markers (e.g., `06:30 IST` or `18:30 IST`), set in `numeric-data` or `label-md`.
- **Text Case:** Structural headlines use sentence case. Status badges, table headers, and KYC flag chips use strictly standardized uppercase tracking (`letter-spacing: 0.05em`).

## Layout & Spacing

This design system uses a strict 8-point base grid (0.5rem increments), paired with 4-point micro-adjustments for fine typographic containment and inline indicators.

### Layout Architecture
- **Worker & Organizer Mobile:** Fluid, single-column viewport layout bounded by `margin: 1rem` (16px) gutter guards. Bottom action bars are permanently pinned above native OS home indicators with safe-area padding.
- **Admin Web Console:** Fluid 12-column grid system bounded inside a maximum 1440px wide canvas, using 24px desktop gutters and 32px canvas margins. Side navigation remains anchored at a fixed width of 260px.
- **Vertical Rhythm:**
  - Structural stack gap: `space-lg` (24px)
  - Card-internal component gap: `space-md` (16px)
  - Form field label-to-input gap: `space-xs` (4px)
  - Inline metadata separation: `space-sm` (8px)

## Elevation & Depth

Visual hierarchy is communicated via clean structural boundaries and layered neutral surfaces, rather than dramatic drop shadows.

### Surface Elevation Strategy
- **Layer 0 (Canvas Base):** Tinted neutral foundation (`#F8F9FA`).
- **Layer 1 (Card & Row Surfaces):** Pure White (`#FFFFFF`) with a 1px solid hairline perimeter (`#E2E4E8`). No blur or ambient shadow in resting state.
- **Layer 2 (Floating Modals & Rosters):** Used for pinned check-in overlays, organizer bottom sheets, and operational popovers.
  - Border: `1px solid #CBD5E1`
  - Shadow: `0 4px 12px -2px rgba(15, 17, 21, 0.06), 0 2px 4px -1px rgba(15, 17, 21, 0.03)`
- **Layer 3 (Executive Notifications & Alerts):** High-priority operational alerts and action sheets.
  - Border: `1px solid #94A3B8`
  - Shadow: `0 12px 32px -4px rgba(15, 17, 21, 0.12), 0 4px 8px -2px rgba(15, 17, 21, 0.04)`

### Interactive Affordance
Elements in a hover or selected state do not lift upward on the z-axis. Instead, state change is indicated by a hairline color shift to `#0F52BA` or an interior stroke token transition (`1.5px solid #0F52BA`).

## Shapes

The shape system employs deliberate, moderate curvature to convey precision and reliability without appearing sharp or unapproachable.

### Corner Radii Guidelines
- **Input Fields & Small Buttons (`rounded` - 6px to 8px):** Clean geometric cornering for dense controls, search bars, and tabular chips.
- **Content Cards & Panels (`rounded-lg` - 12px):** Standard envelope for roster member cards, event summary blocks, and financial ledger items.
- **Bottom Sheets & Modal Dialogs (`rounded-xl` - 16px to 20px):** Mobile action drawers and high-priority desktop dialogues.
- **Pill Elements (`rounded-full`):** Reserved exclusively for state chips, identity verification indicators, and numeric avatar counters.

## Components

### Buttons
- **Primary Action:** Solid `#0F1115` (Black Charcoal) background, `#FFFFFF` text, 8px radius, `min-height: 44px` (touch-safe). On active/focus: transitions to `#0F52BA`.
- **Secondary Action:** Outlined 1px solid `#E2E4E8` with `#FFFFFF` background, `#0F1115` text. On hover: background `#F8F9FA`, border `#CBD5E1`.
- **Destructive Action:** Ghost or outlined with `#B91C1C` text and `#FEE2E2` active fill.
- **Critical Verification State:** High-emphasis primary verification button using `#0F52BA` with high-contrast bold white typography.

### Status Badges & Chips
- Status badges are 24px in height with an internal 6px circular dot indicator or functional icon paired with an all-caps label (`label-xs`).
- Text format: `[ICON / DOT] [EXPLICIT STATUS]` (e.g., `● CHECKED-IN`, `✓ PAID`, `! KYC PENDING`).
- Backgrounds remain desaturated pastels with accessible dark foreground text from the operational state tokens.

### Roster & Event Cards
- Built using 1px hairline border `#E2E4E8` on `#FFFFFF` base with 12px radius.
- Standard metadata layout uses a top header bar (Event Title + Pinned Status Badge), a body data row (Shift Time in IST + Geo-location venue), and an inline footer showing tabular pay per day (`₹`) with a direct action button.

### Form Inputs & Keypad Controls
- **Text & Numeric Inputs:** 44px height, `#FFFFFF` background, 1px solid `#E2E4E8` border, 8px radius.
- **Focus State:** 1.5px solid `#0F52BA` ring without soft outer glow.
- **Labels:** Set in `label-md` (`#0F1115`), with optional assistive hints directly below the input in `body-sm` (`#64748B`).

### Checkboxes & Segmented Controls
- Checkboxes use an 18px square with 4px border radius. When checked: background `#0F52BA` with an embedded crisp white tick mark.
- Segmented role filters (e.g., `All (48) | Checked-in (32) | Pending (16)`) use a container in `#F1F3F5` with active segments rendered as pure white cards with subtle hairline borders.

### Shift Stamp & Geofence Verification Unit
- A specialized operational component displaying geofence validation, showing an active real-time radar icon, venue coordinates, and dual action timestamp triggers (`TAP TO CHECK-IN (IST)`).