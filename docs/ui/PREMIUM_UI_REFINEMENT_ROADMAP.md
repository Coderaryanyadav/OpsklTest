# OPSKL — Premium UI/UX & Interaction Refinement Roadmap

**Target Platforms:** Opskl Worker (Mobile), Opskl Organizer (Mobile), Opskl Admin (Web)  
**Design Paradigm:** Premium Monochromatic High-Contrast System (Black `#0F1115`, Pure White `#FFFFFF`, Slate Neutral Grays `#F8F9FA` / `#E2E4E8`, and Precision Semantic Blue `#0F52BA`).

---

## 1. Executive Summary

This document synthesizes all identified user interface gaps, touch targets, keyboard collisions, typographic hierarchies, and micro-interactions required to elevate Opskl from a functional MVP into an uncompromising, institutional-grade product for Mumbai’s high-stakes event and hospitality operations.

---

## 2. Worker Mobile App Refinements

### A. Authentication & Onboarding
1. **Clean Screen Padding & Keyboard Handling:**
   - Eliminate all banner pills and auxiliary badges that collide with the virtual keyboard on devices under 6.1 inches (e.g., iPhone SE / mini).
   - Maintain a standardized top container margin of `spacing.md` (16px) with dynamic bottom clearance.
2. **Interactive Biometric / Passcode Auth:**
   - Integrate `expo-local-authentication` for FaceID / Fingerprint unlock after initial OTP / password confirmation so active crew members don’t have to re-enter credentials at venue security gates.
3. **Step 2 Identity Verification (KYC) Preview Cards:**
   - Document upload slots must maintain clean vertical flow: `Lock` icon + Slot Title (`Front Side` / `Back Side`) + Truncated file pill without overlapping watermark text.
   - Provide an instant camera capture preview thumbnail when a worker photographs their Aadhaar / PAN card.

### B. Discover Shift Marketplace
1. **Card Elevation & Typography Contrast:**
   - Ensure the wage banner (`₹350/hr • ₹2,800 Total`) uses high-contrast bold typography (`Outfit-Bold` / `Inter-Bold`) with zero text wrapping on 375px viewports.
   - Add a subtle haptic feedback vibration (`expo-haptics`) when a worker swipes or taps "Quick Apply".
2. **Filter Bottom Sheet Experience:**
   - Refactor multi-filter modal (Locality, Shift Timing, Wage Floor) with sticky bottom CTA ("Show 14 Shifts") and clear filter counter pill.

### C. Live Shift & Day-of Attendance
1. **Turnstile Geofenced Check-In Pulse:**
   - When within the 300m geofence radius of premier venues (Jio World Centre, NESCO, Dome SVP), display a pulsing green radar ring rather than static coordinate text.
2. **Offline Mode Hub:**
   - Replace manual retries with an automatic network reconnect listener (`@react-native-community/netinfo`) that drains the offline mutation queue seamlessly the moment cellular or Wi-Fi reconnects.

---

## 3. Organizer Mobile App Refinements

### A. Shift Creator Flow (Multi-Step Stepper)
1. **Step Indicator Contrast:**
   - Use a sleek progress bar with active step titles rather than small dot indicators.
   - Real-time Escrow Calculation Card: Display instant calculations of Crew Wage, Platform Fee (8%), and GST (18%) in a floating bottom summary drawer.
2. **Venue Map Coordinates Tagging:**
   - Add a one-tap venue autofill list with precise latitude/longitude for major Mumbai convention centres (JWC BKC, Bombay Exhibition Centre Goregaon, Taj Lands End, St. Regis).

### B. Live Shift Command Center
1. **Live Check-In Roster Counters:**
   - Large prominent attendance badge: `18 / 20 Checked In (90%)` with real-time green badge.
   - One-tap supervisor manual check-in modal with 4-digit numeric code entry for workers with dead phone batteries or network dead zones.

---

## 4. Admin Web Portal Refinements

### A. Operational Action Queues
1. **High-Density Data Grid:**
   - Use clean monochrome table borders (`border-neutral-200`) with monospace font for booking IDs (`BK-BKC-9201`) and financial ledgers (`₹2,400.00`).
2. **KYC Document Side-by-Side Reviewer:**
   - Provide a split-pane inspector: Left pane shows worker details & masked identifier; right pane provides an interactive zoomable viewer for front & back documents with one-click **"Approve"** (semantic dark) or **"Reject"** (with standardized Mumbai compliance reason dropdown).

---

## 5. Micro-Interactions & Design Tokens

| Element | Current Treatment | Refined Premium Standard |
| :--- | :--- | :--- |
| **Buttons** | Flat background | Micro-scale animation on press (`transform: [{ scale: 0.98 }]`) |
| **Touch Targets** | Variable | Enforced 44×44 pt minimum across all interactive controls |
| **Status Badges** | Generic text tags | Standardized pill tokens with hairline border and uppercase 10px tracking |
| **Modals** | Standard fade | Bottom-sheet slide-up with spring physics and backdrop blur |
| **Empty States** | Text placeholder | Curated monochrome illustration with immediate primary action CTA |

---

## 6. Implementation Status & Progress Matrix

- [x] **P0.1 — Clean Keyboard Avoidance & Padding:** Removed overflowing pill banners and badges colliding with the keyboard in `apps/worker/app/auth/login.tsx`. Standardized 16px margins.
- [x] **P0.2 — KYC Document Card Polish:** Removed overlapping `ENCRYPTED` watermark overlays that bled into filenames in `apps/worker/app/onboarding.tsx`. Added dual front & back document upload slots to secure storage.
- [x] **P0.3 — 44pt Touch Targets:** Enforced 44×44 pt minimum touch targets across all header back buttons, tabs, and action controls.
- [x] **P1.1 — Discover Wage Rate Presentation:** Upgraded `SwipeCard.tsx` with high-contrast typography, zero text wrapping on 375px screens, and clean status tag.
- [x] **P1.2 — Filter Sheet Polish:** Added dynamic sticky count pill ("Show X Shifts") with quick reset and locality cluster indicators in `FilterSheet.tsx`.
- [x] **P1.3 — Geofence Radar Pulse:** Added concentric radar perimeter ring visualization in `GeofencedCheckInModal.tsx` for the 300m venue perimeter.
- [x] **P1.4 — Organizer Live Attendance Badge:** Enhanced `attendance.tsx` with high-visibility `X / Y Checked In (Z% Ready)` badge and direct supervisor code override modal.
- [x] **P1.5 — Mumbai Premier Venues Autofill:** Added one-tap selection chips for JWC BKC, NESCO Goregaon, Dome Worli, and Taj Bandra in `create.tsx`.
- [x] **P1.6 — Admin KYC Split-Pane Reviewer:** Cleaned side-by-side inspector with rotation, zoom, masked Aadhaar UID check, and standardized rejection flow in `VerificationQueue.tsx`.
- [ ] **P2.1 — Biometric FaceID/Fingerprint Auth:** Optional local biometric quick-resume (`expo-local-authentication`).

